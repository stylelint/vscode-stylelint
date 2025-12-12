import { afterEach, describe, expect, it, vi } from 'vitest';

import { normalizeFsPath } from '../fs.js';

describe('normalizeFsPath', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('returns undefined when value is empty', () => {
		expect(normalizeFsPath(undefined)).toBeUndefined();
		expect(normalizeFsPath('')).toBeUndefined();
	});

	it('keeps non-Windows paths unchanged', () => {
		expect(normalizeFsPath('/home/stylelint', 'linux')).toBe('/home/stylelint');
	});

	it('normalizes Windows paths by replacing forward slashes', () => {
		expect(normalizeFsPath('C:/Users/stylelint/project', 'win32')).toBe(
			'C:\\Users\\stylelint\\project',
		);
	});
});
