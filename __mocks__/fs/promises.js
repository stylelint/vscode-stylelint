'use strict';

const path = require('path');
const { createError } = require('../../test/mockSystemErrors');

const fs = jest.createMockFromModule('fs/promises');

/**
 * Mock file system tree for testing.
 * @type {tests.mocks.FileSystemTree}
 */
let mockFileSystem = Object.create(null);

/**
 * Sets the mock file system tree.
 * @param {tests.mocks.FileSystemTree} tree
 * @returns {void}
 */
fs.__mockFileSystem = (tree) => {
	mockFileSystem = tree;
};

/**
 * For a given path, returns the mock file system entry.
 * @param {string} fsPath
 * @returns {tests.mocks.FileSystemEntry}
 */
const getEntry = (fsPath) => {
	const parts = fsPath.split(path.sep);

	/** @type {tests.mocks.FileSystemEntry} */
	let entry = mockFileSystem;

	/** @type {string | undefined} */
	let currentPath = '';

	for (const part of parts) {
		if (typeof entry === 'string' || entry === undefined) {
			return undefined;
		}

		if (entry instanceof Error) {
			return entry;
		}

		if (currentPath) {
			currentPath = path.join(currentPath, part);
		} else {
			currentPath = part;
		}

		entry = entry[part];
	}

	return entry;
};

/**
 * Mock implementation of the `fs.promises.stat` function.
 * @param {string} fsPath
 */
fs.stat = async (fsPath) => {
	const entry = getEntry(fsPath);

	if (entry === undefined) {
		throw createError('ENOENT', fsPath, -4058, 'stat');
	}

	if (entry instanceof Error) {
		throw entry;
	}

	if (typeof entry === 'string') {
		return {
			isDirectory: () => false,
			isFile: () => true,
		};
	}

	return {
		isDirectory: () => true,
		isFile: () => false,
	};
};

module.exports = fs;
