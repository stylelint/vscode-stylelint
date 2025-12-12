import { describe, expect, test } from 'vitest';
import { createToken, inject, module, provideValue } from '../../index.js';
import {
	createRuntimeApplication,
	runtimeService,
	type RuntimeFeature,
	type RuntimeLifecycleParticipant,
} from '../index.js';

const valueToken = createToken<string>('runtime-test-value');
const serviceEvents: string[] = [];

@runtimeService()
@inject({ inject: [valueToken] })
class SampleService implements RuntimeLifecycleParticipant {
	readonly #value: string;

	constructor(value: string) {
		this.#value = value;
	}

	onStart(): void {
		serviceEvents.push(`service:start:${this.#value}`);
	}

	onShutdown(): void {
		serviceEvents.push(`service:shutdown:${this.#value}`);
	}

	dispose(): void {
		serviceEvents.push(`service:dispose:${this.#value}`);
	}
}

@inject()
class PlainService {}

describe('createRuntimeApplication', () => {
	test('runs lifecycle hooks for features and services in order', async () => {
		const events: string[] = [];
		let capturedServices: readonly object[] = [];

		serviceEvents.length = 0;
		const runtimeFeature: RuntimeFeature = {
			start: (context) => {
				events.push('feature:start');
				expect(context.metadata.services).toHaveLength(1);
				capturedServices = context.metadata.services;
			},
			shutdown: () => {
				events.push('feature:shutdown');
			},
			dispose: () => {
				events.push('feature:dispose');
			},
		};

		const runtimeModule = module({
			register: [provideValue(valueToken, () => 'value'), SampleService],
		});

		const app = createRuntimeApplication({
			modules: [runtimeModule],
			features: [runtimeFeature],
		});

		await app.start();
		const resolved = app.resolve(SampleService);

		expect(resolved).toBeInstanceOf(SampleService);

		expect(capturedServices[0]).toBeInstanceOf(SampleService);

		await app.dispose();

		expect(events).toEqual(['feature:start', 'feature:shutdown', 'feature:dispose']);

		expect(serviceEvents).toEqual([
			'service:start:value',
			'service:shutdown:value',
			'service:dispose:value',
		]);
	});

	test('ignores non-runtime services during instantiation', async () => {
		const feature: RuntimeFeature = {
			start: (context) => {
				expect(context.metadata.services).toHaveLength(0);
			},
		};

		serviceEvents.length = 0;

		const runtimeModule = module({
			register: [PlainService],
		});

		const app = createRuntimeApplication({ modules: [runtimeModule], features: [feature] });

		await app.start();
		await app.dispose();
	});
});
