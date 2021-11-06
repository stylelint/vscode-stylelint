import { getFirstReturnValue, getFirstResolvedValue } from '../get-first-return-value';

describe('getFirstReturnValue', () => {
	test("should return the first return value that isn't undefined", () => {
		expect(
			getFirstReturnValue(
				() => 1,
				() => 2,
				() => 3,
			),
		).toBe(1);
		expect(
			getFirstReturnValue(
				() => 1,
				() => undefined,
				() => 3,
			),
		).toBe(1);
		expect(
			getFirstReturnValue(
				() => undefined,
				() => 2,
				() => 3,
			),
		).toBe(2);
		expect(
			getFirstReturnValue(
				() => undefined,
				() => undefined,
				() => 3,
			),
		).toBe(3);
		expect(
			getFirstReturnValue(
				() => undefined,
				() => undefined,
				() => undefined,
			),
		).toBeUndefined();
		expect(
			getFirstReturnValue(
				() => undefined,
				() => null,
				() => undefined,
			),
		).toBeNull();
	});

	test('should not call any subsequent functions after the first return value is found', () => {
		const fn = jest.fn(() => 1);

		getFirstReturnValue(fn, fn, fn);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	test('if a function throws an error, it should be thrown', () => {
		expect(() =>
			getFirstReturnValue(() => {
				throw new Error('foo');
			}),
		).toThrow('foo');
	});
});

describe('getFirstResolvedValue', () => {
	test("should resolve to the first resolved value that isn't undefined", async () => {
		await expect(
			getFirstResolvedValue(
				async () => 1,
				async () => 2,
				async () => 3,
			),
		).resolves.toBe(1);
		await expect(
			getFirstResolvedValue(
				async () => 1,
				async () => undefined,
				async () => 3,
			),
		).resolves.toBe(1);
		await expect(
			getFirstResolvedValue(
				async () => undefined,
				async () => 2,
				async () => 3,
			),
		).resolves.toBe(2);
		await expect(
			getFirstResolvedValue(
				async () => undefined,
				async () => undefined,
				async () => 3,
			),
		).resolves.toBe(3);
		await expect(
			getFirstResolvedValue(
				async () => undefined,
				async () => undefined,
				async () => undefined,
			),
		).resolves.toBeUndefined();
		await expect(
			getFirstResolvedValue(
				async () => undefined,
				async () => null,
				async () => undefined,
			),
		).resolves.toBeNull();
	});

	test('should not call any subsequent functions after the first resolved value is found', async () => {
		const fn = jest.fn(async () => 1);

		await getFirstResolvedValue(fn, fn, fn);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	test('if a function rejects, it should be rejected', async () => {
		await expect(
			getFirstResolvedValue(async () => {
				throw new Error('foo');
			}),
		).rejects.toThrow('foo');
	});
});
