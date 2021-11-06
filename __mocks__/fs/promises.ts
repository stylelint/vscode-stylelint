import path from 'path';
import { createError } from '../../test/mockSystemErrors';
import type { Stats } from 'fs';

const fs = jest.createMockFromModule('fs/promises') as tests.mocks.FSPromisesModule;

/**
 * Mock file system tree for testing.
 */
let mockFileSystem: tests.mocks.FileSystemTree = Object.create(null);

/**
 * Sets the mock file system tree.
 */
fs.__mockFileSystem = (tree: tests.mocks.FileSystemTree): void => {
	mockFileSystem = tree;
};

/**
 * For a given path, returns the mock file system entry.
 */
const getEntry = (fsPath: string): tests.mocks.FileSystemEntry => {
	const parts = fsPath.split(path.sep);
	let entry: tests.mocks.FileSystemEntry = mockFileSystem;
	let currentPath: string | undefined = '';

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
 */
fs.stat = jest.fn(async (fsPath: string) => {
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
		} as Stats;
	}

	return {
		isDirectory: () => true,
		isFile: () => false,
	} as Stats;
}) as unknown as jest.MockedFunction<typeof fs.stat>;

export = fs;
