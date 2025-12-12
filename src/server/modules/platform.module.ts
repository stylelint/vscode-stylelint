// @no-unit-test -- No logic, just DI module definition.

import * as childProcess from 'node:child_process';
import * as fsPromises from 'node:fs/promises';
import os from 'node:os';
import * as pathModule from 'node:path';
import * as readline from 'node:readline';
import pathIsInside from 'path-is-inside';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { TextDocuments } from 'vscode-languageserver/node';
import { URI } from 'vscode-uri';
import { module, provideValue } from '../../di/index.js';
import {
	ChildProcessModuleToken,
	FsPromisesModuleToken,
	NormalizeFsPathToken,
	OsModuleToken,
	PathIsInsideToken,
	PathModuleToken,
	ReadlineModuleToken,
	UriModuleToken,
	textDocumentsToken,
} from '../tokens.js';
import { normalizeFsPath } from '../utils/index.js';

/**
 * Creates a new platform module.
 */
export const platformModule = module({
	register: [
		// Node.js modules

		provideValue(FsPromisesModuleToken, () => fsPromises),
		provideValue(PathModuleToken, () => pathModule),
		provideValue(OsModuleToken, () => os),
		provideValue(ChildProcessModuleToken, () => childProcess),
		provideValue(ReadlineModuleToken, () => readline),

		// 3rd-party modules

		provideValue(UriModuleToken, () => URI),
		provideValue(PathIsInsideToken, () => pathIsInside),
		provideValue(NormalizeFsPathToken, () => normalizeFsPath),

		// Services and utilities

		provideValue(textDocumentsToken, () => new TextDocuments(TextDocument)),
	],
});
