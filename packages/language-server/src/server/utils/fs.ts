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

	return platform === 'win32' ? value.replace(/\//gu, '\\') : value;
}
