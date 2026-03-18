import type { Container } from '../container.js';
import type { InjectionToken } from '../inject.js';

export type MaybePromise<T> = T | Promise<T>;

export interface RuntimeMetadata {
	readonly services: readonly object[];
}

export interface RuntimeContext {
	readonly container: Container;
	readonly resolve: <T>(token: InjectionToken<T>) => T;
	readonly metadata: RuntimeMetadata;
}

export interface RuntimeLifecycleParticipant {
	onStart?(context: RuntimeContext): MaybePromise<void>;
	onShutdown?(context: RuntimeContext): MaybePromise<void>;
}

export interface RuntimeFeature {
	start?(context: RuntimeContext): MaybePromise<void>;
	shutdown?(context: RuntimeContext): MaybePromise<void>;
	dispose?(): void;
}
