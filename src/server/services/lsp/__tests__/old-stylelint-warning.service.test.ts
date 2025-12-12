import { beforeEach, describe, expect, it } from 'vitest';
import type { Connection } from 'vscode-languageserver';
import * as LSP from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { TextDocumentChangeEvent } from 'vscode-languageserver/node';

import {
	createLoggingServiceStub,
	createStylelintRunnerStub,
	type StylelintRunnerStub,
} from '../../../../../test/helpers/stubs/index.js';
import { createTestLogger, type TestLogger } from '../../../../../test/helpers/test-logger.js';
import { createContainer, module, provideTestValue } from '../../../../di/index.js';
import { defaultLanguageServerOptions } from '../../../config/default-options.js';
import type { StylelintResolutionResult } from '../../../stylelint/index.js';
import { NormalizeFsPathToken, PathIsInsideToken, lspConnectionToken } from '../../../tokens.js';
import { loggingServiceToken, type LoggingService } from '../../infrastructure/logging.service.js';
import { StylelintRunnerService } from '../../stylelint-runtime/stylelint-runner.service.js';
import { WorkspaceFolderService } from '../../workspace/workspace-folder.service.js';
import { WorkspaceOptionsService } from '../../workspace/workspace-options.service.js';
import { OldStylelintWarningLspService } from '../old-stylelint-warning.service.js';

const migrationGuideUrl =
	'https://github.com/stylelint/vscode-stylelint#migrating-from-vscode-stylelint-0xstylelint-13x';
const warningMessage = (version: string) =>
	`Stylelint version ${version} is no longer supported. While it may continue to work for a while, you may encounter unexpected behavior. Please upgrade to version 14.0.0 or newer. See the migration guide for more information.`;

type WorkspaceOptionsServiceStub = Pick<WorkspaceOptionsService, 'getOptions'>;

type WorkspaceFolderServiceStub = Pick<WorkspaceFolderService, 'getWorkspaceFolder'>;

type WorkspaceResolver = {
	service: WorkspaceFolderServiceStub;
	setWorkspaceFolder(uri: string, folder: string | undefined): void;
};

type WarningConnectionStub = {
	connection: Connection;
	windowMessages: Array<{ type: 'warn'; message: string }>;
	windowShowDocumentCalls: LSP.ShowDocumentParams[];
	setShowWarningMessageResponder(
		responder: (
			message: string,
			...items: Array<LSP.MessageActionItem | string>
		) => Promise<LSP.MessageActionItem | string | undefined>,
	): void;
};

function createWarningConnectionStub(): WarningConnectionStub {
	const windowMessages: WarningConnectionStub['windowMessages'] = [];
	const windowShowDocumentCalls: WarningConnectionStub['windowShowDocumentCalls'] = [];
	let warningResponder:
		| ((
				message: string,
				...items: Array<LSP.MessageActionItem | string>
		  ) => Promise<LSP.MessageActionItem | string | undefined>)
		| undefined;

	const connection = {
		window: {
			showWarningMessage: async (
				message: string,
				...items: Array<LSP.MessageActionItem | string>
			) => {
				windowMessages.push({ type: 'warn', message });

				return warningResponder ? warningResponder(message, ...items) : undefined;
			},
			showDocument: async (params: LSP.ShowDocumentParams) => {
				windowShowDocumentCalls.push(params);

				return { success: true };
			},
		},
	} as unknown as Connection;

	return {
		connection,
		windowMessages,
		windowShowDocumentCalls,
		setShowWarningMessageResponder: (responder) => {
			warningResponder = responder;
		},
	};
}

function createDocument(uri = 'file:///workspace/test.css', languageId = 'css'): TextDocument {
	return TextDocument.create(uri, languageId, 1, 'a {}');
}

function createChangeEvent(document: TextDocument): TextDocumentChangeEvent<TextDocument> {
	return { document };
}

function createWorkspaceResolver(): WorkspaceResolver {
	const folders = new Map<string, string | undefined>();

	return {
		service: {
			async getWorkspaceFolder(_connection: Connection, document: TextDocument) {
				return folders.get(document.uri);
			},
		} as WorkspaceFolderServiceStub,
		setWorkspaceFolder: (uri: string, folder: string | undefined) => {
			folders.set(uri, folder);
		},
	};
}

function createResolution(
	overrides: Partial<StylelintResolutionResult> = {},
): StylelintResolutionResult {
	return {
		entryPath: Object.prototype.hasOwnProperty.call(overrides, 'entryPath')
			? overrides.entryPath!
			: '/workspace/node_modules/stylelint/index.js',
		resolvedPath: Object.prototype.hasOwnProperty.call(overrides, 'resolvedPath')
			? overrides.resolvedPath!
			: '/workspace/node_modules/stylelint',
		version: Object.prototype.hasOwnProperty.call(overrides, 'version')
			? overrides.version
			: '13.0.0',
	};
}

describe('OldStylelintWarningLspModule', () => {
	let service: OldStylelintWarningLspService;
	let options: WorkspaceOptionsServiceStub;
	let runner: StylelintRunnerStub;
	let connection: WarningConnectionStub;
	let logger: TestLogger;
	let loggingService: LoggingService;
	let workspaceResolver: WorkspaceResolver;

	const setWorkspaceFolder = (document: TextDocument, folder: string | undefined) => {
		workspaceResolver.setWorkspaceFolder(document.uri, folder);
	};

	const setStylelintResolution = (
		document: TextDocument,
		result: StylelintResolutionResult = createResolution(),
	) => {
		runner.setResolution(document.uri, result);
	};

	const handleDocumentOpened = async (document: TextDocument) => {
		await service.handleDocumentOpened(createChangeEvent(document));
	};

	const setShowWarningMessageResponder: WarningConnectionStub['setShowWarningMessageResponder'] = (
		responder,
	) => {
		connection.setShowWarningMessageResponder(responder);
	};

	beforeEach(() => {
		options = {
			async getOptions() {
				return defaultLanguageServerOptions;
			},
		};
		runner = createStylelintRunnerStub();
		connection = createWarningConnectionStub();
		logger = createTestLogger();
		loggingService = createLoggingServiceStub(logger);
		workspaceResolver = createWorkspaceResolver();

		const normalizeFsPath = (path: string | undefined) => path;
		const pathIsInside = (child: string, parent: string) =>
			Boolean(child && parent && child.startsWith(parent));

		const container = createContainer(
			module({
				register: [
					provideTestValue(WorkspaceOptionsService, () => options as WorkspaceOptionsService),
					provideTestValue(
						StylelintRunnerService,
						() => runner as unknown as StylelintRunnerService,
					),
					provideTestValue(
						WorkspaceFolderService,
						() => workspaceResolver.service as unknown as WorkspaceFolderService,
					),
					provideTestValue(NormalizeFsPathToken, () => normalizeFsPath),
					provideTestValue(PathIsInsideToken, () => pathIsInside),
					provideTestValue(lspConnectionToken, () => connection.connection),
					provideTestValue(loggingServiceToken, () => loggingService),
					OldStylelintWarningLspService,
				],
			}),
		);

		service = container.resolve(OldStylelintWarningLspService);
	});

	it('should be constructable', () => {
		expect(service).toBeInstanceOf(OldStylelintWarningLspService);
	});

	it('if document is not part of a workspace, should not warn', async () => {
		const document = createDocument('file:///no-workspace/test.css');

		setWorkspaceFolder(document, undefined);
		await handleDocumentOpened(document);

		expect(runner.lintCalls).toHaveLength(0);
		expect(connection.windowMessages).toHaveLength(0);
		expect(logger.debug).toHaveBeenLastCalledWith('Document not part of a workspace, ignoring', {
			uri: document.uri,
		});
	});

	it('if workspace already checked, should not warn twice', async () => {
		const document = createDocument();

		setWorkspaceFolder(document, '/workspace');
		setStylelintResolution(document, createResolution());

		await handleDocumentOpened(document);
		await handleDocumentOpened(document);

		expect(connection.windowMessages).toHaveLength(1);
		expect(logger.debug).toHaveBeenLastCalledWith('Workspace already checked, ignoring', {
			uri: document.uri,
		});
	});

	it('if Stylelint is not found, should not warn', async () => {
		const document = createDocument();

		setWorkspaceFolder(document, '/workspace');
		await handleDocumentOpened(document);

		expect(connection.windowMessages).toHaveLength(0);
		expect(logger.debug).toHaveBeenLastCalledWith('Stylelint not found', {
			uri: document.uri,
		});
	});

	it('if package root is outside workspace, should not warn', async () => {
		const document = createDocument();

		setWorkspaceFolder(document, '/workspace');
		setStylelintResolution(document, createResolution({ resolvedPath: '/external/stylelint' }));

		await handleDocumentOpened(document);

		expect(connection.windowMessages).toHaveLength(0);
		expect(logger.debug).toHaveBeenLastCalledWith(
			'Stylelint package root is not inside the workspace',
			{ uri: document.uri },
		);
	});

	it('if Stylelint version is not available, should not warn', async () => {
		const document = createDocument();

		setWorkspaceFolder(document, '/workspace');
		setStylelintResolution(document, createResolution({ version: undefined }));

		await handleDocumentOpened(document);

		expect(connection.windowMessages).toHaveLength(0);
		expect(logger.debug).toHaveBeenLastCalledWith('Stylelint version not available from worker', {
			uri: document.uri,
		});
	});

	it('if Stylelint version cannot be parsed, should not warn', async () => {
		const document = createDocument();

		setWorkspaceFolder(document, '/workspace');
		setStylelintResolution(document, createResolution({ version: 'foo' }));

		await handleDocumentOpened(document);

		expect(connection.windowMessages).toHaveLength(0);
		expect(logger.debug).toHaveBeenLastCalledWith('Stylelint version could not be parsed', {
			uri: document.uri,
			version: 'foo',
			error: expect.any(Error),
		});
	});

	it('if Stylelint version is 14.x or newer, should not warn', async () => {
		const document = createDocument();

		setWorkspaceFolder(document, '/workspace');
		setStylelintResolution(document, createResolution({ version: '14.0.0' }));

		await handleDocumentOpened(document);

		expect(connection.windowMessages).toHaveLength(0);
	});

	it('if Stylelint version is 14.x with label, should not warn', async () => {
		const document = createDocument();

		setWorkspaceFolder(document, '/workspace');
		setStylelintResolution(document, createResolution({ version: '14.0.0-beta.1' }));

		await handleDocumentOpened(document);

		expect(connection.windowMessages).toHaveLength(0);
	});

	it('without showDocument support, should warn when Stylelint < 14', async () => {
		const document = createDocument();

		service.onInitialize({ capabilities: {} } as LSP.InitializeParams);
		setWorkspaceFolder(document, '/workspace');
		setStylelintResolution(document, createResolution({ version: '13.0.0' }));

		await handleDocumentOpened(document);

		expect(connection.windowMessages).toEqual([
			{ type: 'warn', message: warningMessage('13.0.0') },
		]);
		expect(connection.windowShowDocumentCalls).toHaveLength(0);
	});

	it('with showDocument support and user accepts, should open migration guide', async () => {
		const document = createDocument();

		service.onInitialize({
			capabilities: { window: { showDocument: { support: true } } },
		} as LSP.InitializeParams);
		setWorkspaceFolder(document, '/workspace');
		setStylelintResolution(document, createResolution({ version: '13.0.0' }));
		setShowWarningMessageResponder(async (_message, ...items) => {
			return items[0] as LSP.MessageActionItem;
		});

		await handleDocumentOpened(document);

		expect(connection.windowMessages).toEqual([
			{ type: 'warn', message: warningMessage('13.0.0') },
		]);
		expect(connection.windowShowDocumentCalls).toEqual([
			{ uri: migrationGuideUrl, external: true },
		]);
	});
});
