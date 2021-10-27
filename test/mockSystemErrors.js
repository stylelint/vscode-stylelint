'use strict';

// Part of test utils, don't record coverage
/* istanbul ignore file */

const util = require('util');

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
 * @param {keyof typeof errorMessages} code
 * @param {string} fsPath
 * @param {number} errno
 * @param {string} syscall
 */
const createError = (code, fsPath, errno, syscall) =>
	Object.assign(new Error(util.format(errorMessages[code], fsPath)), {
		code,
		errno,
		path: fsPath,
		syscall,
	});

module.exports = {
	createError,
};
