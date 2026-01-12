import { describe, expect, test } from 'vitest';

import { getInjectMetadata, inject } from '../inject.js';
import { createToken } from '../tokens.js';

describe('inject decorator', () => {
	test('decorating a class without options defaults to singleton scope', () => {
		@inject()
		class DefaultInjection {}

		expect(getInjectMetadata(DefaultInjection)).toEqual({
			scope: 'singleton',
			inject: [],
		});
	});

	test('decorator stores the provided scope and tokens', () => {
		const ValueToken = createToken<number>('value');

		@inject({ scope: 'transient', inject: [ValueToken] })
		class WithDependencies {
			public constructor(public readonly value: number) {}
		}

		expect(getInjectMetadata(WithDependencies)).toEqual({
			scope: 'transient',
			inject: [ValueToken],
		});
	});

	test('getInjectMetadata returns undefined for undecorated classes', () => {
		class Plain {}

		expect(getInjectMetadata(Plain)).toBeUndefined();
	});
});
