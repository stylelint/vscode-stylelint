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

	it('uppercases a lowercase Windows drive letter', () => {
		expect(normalizeFsPath('c:\\Users\\stylelint', 'win32')).toBe('C:\\Users\\stylelint');
	});

	it('keeps an uppercase Windows drive letter unchanged', () => {
		expect(normalizeFsPath('C:\\Users\\stylelint', 'win32')).toBe('C:\\Users\\stylelint');
	});

	it('uppercases drive letter when also replacing forward slashes', () => {
		expect(normalizeFsPath('e:/vscode-stylelint', 'win32')).toBe('E:\\vscode-stylelint');
	});

	it('does not modify non-drive-letter paths on Windows', () => {
		expect(normalizeFsPath('\\\\server\\share', 'win32')).toBe('\\\\server\\share');
	});
});
