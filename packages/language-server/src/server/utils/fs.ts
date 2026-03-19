import process from 'node:process';

/**
 * Normalizes file system paths based on the operating system.
 */
export function normalizeFsPath(
	value: string | undefined,
	platform: NodeJS.Platform = process.platform,
): string | undefined {
	if (!value) {
		return undefined;
	}

	if (platform !== 'win32') {
		return value;
	}

	let result = value.replace(/\//gu, '\\');

	if (/^[a-z]:\\/u.test(result)) {
		result = result[0].toUpperCase() + result.slice(1);
	}

	return result;
}
