import { createContainer, type Container } from '../container.js';
import type { InjectionToken } from '../inject.js';
import type { ModuleMetadata } from '../module.js';
import { isRuntimeServiceConstructor, type RuntimeServiceConstructor } from './decorators.js';
import type { RuntimeContext, RuntimeFeature, RuntimeLifecycleParticipant } from './types.js';

export interface RuntimeApplicationOptions {
	modules: ModuleMetadata[];
	overrides?: Iterable<[InjectionToken<unknown>, unknown]>;
	features?: RuntimeFeature[];
}

export interface RuntimeApplication {
	start(): Promise<void>;
	dispose(): Promise<void>;
	resolve<T>(token: InjectionToken<T>): T;
}

/**
 * Collects all runtime service constructors from the provided modules.
 */
function collectRuntimeServiceConstructors(
	modules: ModuleMetadata[],
): Set<RuntimeServiceConstructor> {
	const constructors = new Set<RuntimeServiceConstructor>();

	for (const metadata of modules) {
		for (const [token] of metadata.providers) {
			if (typeof token === 'function' && isRuntimeServiceConstructor(token)) {
				constructors.add(token);
			}
		}
	}

	return constructors;
}

/**
 * Determines if the provided value implements the runtime lifecycle participant contract.
 */
function isLifecycleParticipant(value: unknown): value is RuntimeLifecycleParticipant {
	return (
		typeof value === 'object' &&
		value !== null &&
		(typeof (value as RuntimeLifecycleParticipant).onStart === 'function' ||
			typeof (value as RuntimeLifecycleParticipant).onShutdown === 'function')
	);
}

class DefaultRuntimeApplication implements RuntimeApplication {
	readonly #container: Container;
	readonly #modules: ModuleMetadata[];
	readonly #features: RuntimeFeature[];
	readonly #services: object[] = [];
	readonly #participants: RuntimeLifecycleParticipant[] = [];
	#started = false;
	#disposed = false;
	#startPromise?: Promise<void>;
	#disposePromise?: Promise<void>;

	constructor(container: Container, modules: ModuleMetadata[], features: RuntimeFeature[]) {
		this.#container = container;
		this.#modules = modules;
		this.#features = features;
	}

	async start(): Promise<void> {
		if (this.#startPromise) {
			return this.#startPromise;
		}

		if (this.#disposed) {
			throw new Error('Cannot start a disposed runtime application.');
		}

		this.#startPromise = this.#startInternal();

		return this.#startPromise;
	}

	async #startInternal(): Promise<void> {
		if (this.#started) {
			return;
		}

		this.#instantiateRuntimeServices();
		const context = this.#createContext();

		await this.#runFeatures('start', context);
		await this.#runParticipants('onStart', context);

		this.#started = true;
	}

	async dispose(): Promise<void> {
		if (this.#disposePromise) {
			return this.#disposePromise;
		}

		this.#disposePromise = this.#disposeInternal();

		return this.#disposePromise;
	}

	resolve<T>(token: InjectionToken<T>): T {
		return this.#container.resolve(token);
	}

	async #disposeInternal(): Promise<void> {
		if (this.#disposed) {
			return;
		}

		if (this.#startPromise) {
			await this.#startPromise;
		}

		if (!this.#started) {
			this.#disposed = true;

			return;
		}

		const context = this.#createContext();

		const participantErrors = await this.#runParticipants('onShutdown', context, true);
		const featureErrors = await this.#runFeatures('shutdown', context, true);

		this.#disposeServices();
		this.#disposeFeatures();

		this.#participants.length = 0;
		this.#services.length = 0;

		this.#disposed = true;

		if (participantErrors.length > 0 || featureErrors.length > 0) {
			const firstError = participantErrors.length > 0 ? participantErrors[0] : featureErrors[0];

			throw this.#normalizeDisposalError(firstError);
		}
	}

	#normalizeDisposalError(error: unknown): Error {
		if (error instanceof Error) {
			return error;
		}

		if (typeof error === 'string') {
			return new Error(error);
		}

		if (typeof error === 'undefined') {
			return new Error('unknown');
		}

		try {
			const serialized = JSON.stringify(error);

			return new Error(serialized ?? 'unknown');
		} catch {
			return new Error('unknown');
		}
	}

	#createContext(): RuntimeContext {
		const resolve = <T>(token: InjectionToken<T>): T => this.#container.resolve(token);

		return {
			container: this.#container,
			resolve,
			metadata: {
				services: this.#services,
			},
		};
	}

	#instantiateRuntimeServices(): void {
		if (this.#services.length > 0) {
			return;
		}

		const constructors = collectRuntimeServiceConstructors(this.#modules);

		for (const ctor of constructors) {
			const instance = this.#container.resolve(ctor);

			if (typeof instance !== 'object' || instance === null) {
				throw new Error('Runtime services must be class instances.');
			}

			this.#services.push(instance);

			if (isLifecycleParticipant(instance)) {
				this.#participants.push(instance);
			}
		}
	}

	async #runParticipants(
		method: 'onStart' | 'onShutdown',
		context: RuntimeContext,
		ignoreErrors = false,
	): Promise<unknown[]> {
		const errors: unknown[] = [];

		for (const participant of this.#participants) {
			const handler = participant[method];

			if (!handler) {
				continue;
			}

			try {
				await handler.call(participant, context);
			} catch (error) {
				if (!ignoreErrors) {
					throw error;
				}

				errors.push(error);
			}
		}

		return errors;
	}

	async #runFeatures(
		method: 'start' | 'shutdown',
		context: RuntimeContext,
		ignoreErrors = false,
	): Promise<unknown[]> {
		const errors: unknown[] = [];

		for (const feature of this.#features) {
			const handler = feature[method];

			if (!handler) {
				continue;
			}

			try {
				await handler.call(feature, context);
			} catch (error) {
				if (!ignoreErrors) {
					throw error;
				}

				errors.push(error);
			}
		}

		return errors;
	}

	#disposeServices(): void {
		for (const service of this.#services) {
			if (typeof (service as { dispose?: () => void }).dispose === 'function') {
				try {
					(service as { dispose: () => void }).dispose();
				} catch {
					// Best-effort cleanup.
				}
			}
		}
	}

	#disposeFeatures(): void {
		for (const feature of this.#features) {
			if (typeof feature.dispose === 'function') {
				try {
					feature.dispose();
				} catch {
					// Best-effort cleanup.
				}
			}
		}
	}
}

/**
 * Creates a runtime application backed by the shared dependency injection container.
 */
export function createRuntimeApplication(options: RuntimeApplicationOptions): RuntimeApplication {
	const container = createContainer(options.modules, { overrides: options.overrides });

	return new DefaultRuntimeApplication(container, options.modules, options.features ?? []);
}
