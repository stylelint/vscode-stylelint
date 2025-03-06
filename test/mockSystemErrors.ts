// Part of test utils, don't record coverage
/* istanbul ignore file */

import util from 'util';

/**
 * Mock file system error messages by code.
 */
const errorMessages = {
	EACCES: "EACCES: permission denied, open '%s'",
	ENOENT: "ENOENT: no such file or directory, open '%s'",
	ENOTDIR: "ENOTDIR: not a directory, open '%s'",
};

/**
 * Creates a mock file system error.
 */
export const createError = (
	code: keyof typeof errorMessages,
	fsPath: string,
	errno: number,
	syscall: string,
): Error & {
	code: keyof typeof errorMessages;
	errno: number;
	path: string;
	syscall: string;
} =>
	Object.assign(new Error(util.format(errorMessages[code], fsPath)), {
		code,
		errno,
		path: fsPath,
		syscall,
	});
