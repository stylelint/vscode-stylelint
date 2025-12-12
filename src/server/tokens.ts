// @no-unit-test -- No logic, just DI token definitions.

import type pathIsInside from 'path-is-inside';
import type { Connection } from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { TextDocuments } from 'vscode-languageserver/node';
import type { URI } from 'vscode-uri';
import type winston from 'winston';
import { createToken } from '../di/tokens.js';
import type { normalizeFsPath } from './utils/index.js';
import type { WorkspaceStylelintService } from './services/stylelint-runtime/workspace-stylelint.service.js';

// Node.js modules

export const FsPromisesModuleToken = createToken<typeof import('node:fs/promises')>('FileSystem');
export const PathModuleToken = createToken<typeof import('node:path')>('PathModule');
export const OsModuleToken = createToken<typeof import('node:os')>('OsModule');
export const ChildProcessModuleToken =
	createToken<typeof import('node:child_process')>('ChildProcessModule');
export const ReadlineModuleToken = createToken<typeof import('node:readline')>('ReadlineModule');
export const UriModuleToken = createToken<typeof URI>('UriModule');

// 3rd-party modules

export const PathIsInsideToken = createToken<typeof pathIsInside>('PathIsInside');
export const NormalizeFsPathToken = createToken<typeof normalizeFsPath>('NormalizeFsPath');
export const textDocumentsToken = createToken<TextDocuments<TextDocument>>('TextDocuments');
export const lspConnectionToken = createToken<Connection>('LspConnection');

type WorkspaceStylelintServiceFactory = (logger?: winston.Logger) => WorkspaceStylelintService;

export const WorkspaceStylelintServiceFactoryToken = createToken<WorkspaceStylelintServiceFactory>(
	'WorkspaceStylelintServiceFactory',
);
