import { serializeErrors } from '../errors';

describe('serializeErrors', () => {
	it('should serialize objects with errors', () => {
		const error = Object.assign(new Error('error'), { code: 'code' });

		const result = serializeErrors({ error, property: 'value' });

		expect(result).toStrictEqual({
			error: {
				name: 'Error',
				message: 'error',
				stack: expect.any(String),
				code: 'code',
			},
			property: 'value',
		});
	});

	it('should serialize errors', () => {
		const error = Object.assign(new Error('error'), { code: 'code' });

		const result = serializeErrors(error);

		expect(result).toStrictEqual({
			name: 'Error',
			message: 'error',
			stack: expect.any(String),
			code: 'code',
		});
	});

	it('should serialize errors with nested errors', () => {
		const error = Object.assign(new Error('error'), { nested: new Error('nested error') });

		const result = serializeErrors(error);

		expect(result).toStrictEqual({
			name: 'Error',
			message: 'error',
			stack: expect.any(String),
			nested: {
				name: 'Error',
				message: 'nested error',
				stack: expect.any(String),
			},
		});
	});

	it('should serialize arrays with errors', () => {
		const errors = [new Error('error 1'), Object.assign(new Error('error 2'), { code: 'code 2' })];

		const result = serializeErrors(errors);

		expect(result).toStrictEqual([
			{
				message: 'error 1',
				name: 'Error',
				stack: expect.any(String),
			},
			{
				message: 'error 2',
				name: 'Error',
				code: 'code 2',
				stack: expect.any(String),
			},
		]);
	});

	it('should serialize maps with errors', () => {
		const errors = new Map<Error | string, Error | string>([
			['key 1', new Error('error 1')],
			[new Error('error 2'), 'value 2'],
		]);

		const result = serializeErrors(errors);

		expect(result).toStrictEqual(
			new Map<Record<string, unknown> | string, Record<string, unknown> | string>([
				[
					'key 1',
					{
						message: 'error 1',
						name: 'Error',
						stack: expect.any(String),
					},
				],
				[
					{
						message: 'error 2',
						name: 'Error',
						stack: expect.any(String),
					},
					'value 2',
				],
			]),
		);
	});

	it('should serialize sets with errors', () => {
		const errors = new Set<Error | string>([new Error('error 1'), 'error 2']);

		const result = serializeErrors(errors);

		expect(result).toStrictEqual(
			new Set<Record<string, unknown> | string>([
				{
					message: 'error 1',
					name: 'Error',
					stack: expect.any(String),
				},
				'error 2',
			]),
		);
	});

	it('should serialize iterables with errors', () => {
		const errors = [new Error('error 1'), Object.assign(new Error('error 2'), { code: 'code 2' })];

		const result = serializeErrors(errors[Symbol.iterator]());

		expect(result).toStrictEqual([
			{
				message: 'error 1',
				name: 'Error',
				stack: expect.any(String),
			},
			{
				message: 'error 2',
				name: 'Error',
				code: 'code 2',
				stack: expect.any(String),
			},
		]);
	});

	it('should serialize objects with circular references', () => {
		const error = Object.assign(new Error('error'), { code: 'code' });

		type TestObject = { error: Error & { code: 'code' } };
		type CircularReferenceObject = TestObject & {
			circular: CircularReferenceObject;
			circularArray: CircularReferenceObject[];
		};

		const obj = { error } as CircularReferenceObject;

		obj.circular = obj;
		obj.circularArray = [obj];

		const result = serializeErrors(obj);

		expect(result).toStrictEqual({
			error: {
				name: 'Error',
				message: 'error',
				stack: expect.any(String),
				code: 'code',
			},
			circular: '[Circular]',
			circularArray: ['[Circular]'],
		});
	});

	it('should not modify non-error objects', () => {
		// Create object with non-enumerable property
		const obj = Object.create(null);

		Object.defineProperty(obj, 'prop', {
			value: 'value',
			enumerable: false,
		});

		const result = serializeErrors(obj);

		expect(result).toStrictEqual({});
	});

	it('should not modify non-object values', () => {
		expect(serializeErrors(null)).toBeNull();
		expect(serializeErrors(undefined)).toBeUndefined();
		expect(serializeErrors(true)).toBe(true);
		expect(serializeErrors(0)).toBe(0);
		expect(serializeErrors('')).toBe('');
		expect(serializeErrors('string')).toBe('string');
	});
});
