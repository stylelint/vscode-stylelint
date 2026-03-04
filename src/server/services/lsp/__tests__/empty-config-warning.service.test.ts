import { beforeEach, describe, expect, it } from 'vitest';
import type { Connection } from 'vscode-languageserver';
import * as LSP from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { TextDocumentChangeEvent } from 'vscode-languageserver/node';

import {
	createLoggingServiceStub,
	createWorkspaceFolderStub,
	createWorkspaceOptionsStub,
	type WorkspaceFolderServiceStub,
	type WorkspaceOptionsServiceStub,
} from '../../../../../test/helpers/stubs/index.js';
import { createTestLogger, type TestLogger } from '../../../../../test/helpers/test-logger.js';
import { createContainer, module, provideTestValue } from '../../../../di/index.js';
import { defaultLanguageServerOptions } from '../../../config/default-options.js';
import { lspConnectionToken } from '../../../tokens.js';
import { loggingServiceToken, type LoggingService } from '../../infrastructure/logging.service.js';
import { WorkspaceFolderService } from '../../workspace/workspace-folder.service.js';
import { WorkspaceOptionsService } from '../../workspace/workspace-options.service.js';
import { EmptyConfigWarningLspService } from '../empty-config-warning.service.js';
import type { LanguageServerOptions } from '../../../types.js';

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

describe('EmptyConfigWarningLspService', () => {
	let service: EmptyConfigWarningLspService;
	let options: WorkspaceOptionsServiceStub;
	let connection: WarningConnectionStub;
	let logger: TestLogger;
	let loggingService: LoggingService;
	let workspaceFolderService: WorkspaceFolderServiceStub;

	const setWorkspaceFolder = (document: TextDocument, folder: string | undefined) => {
		workspaceFolderService.setWorkspaceFolder(document.uri, folder);
	};

	const setOptions = (document: TextDocument, config: LanguageServerOptions['config']) => {
		options.setOptions(document.uri, { ...defaultLanguageServerOptions, config });
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
		options = createWorkspaceOptionsStub();
		connection = createWarningConnectionStub();
		logger = createTestLogger();
		loggingService = createLoggingServiceStub(logger);
		workspaceFolderService = createWorkspaceFolderStub();

		const container = createContainer(
			module({
				register: [
					provideTestValue(
						WorkspaceOptionsService,
						() => options as unknown as WorkspaceOptionsService,
					),
					provideTestValue(
						WorkspaceFolderService,
						() => workspaceFolderService as unknown as WorkspaceFolderService,
					),
					provideTestValue(lspConnectionToken, () => connection.connection),
					provideTestValue(loggingServiceToken, () => loggingService),
					EmptyConfigWarningLspService,
				],
			}),
		);

		service = container.resolve(EmptyConfigWarningLspService);
	});

	it('should be constructable', () => {
		expect(service).toBeInstanceOf(EmptyConfigWarningLspService);
	});

	it('if document is not part of a workspace, should not warn', async () => {
		const document = createDocument('file:///no-workspace/test.css');

		setWorkspaceFolder(document, undefined);
		await handleDocumentOpened(document);

		expect(connection.windowMessages).toHaveLength(0);
		expect(logger.debug).toHaveBeenLastCalledWith('Document not part of a workspace, ignoring', {
			uri: document.uri,
		});
	});

	it('if already warned about empty config in workspace, should not warn twice', async () => {
		const document = createDocument();

		setWorkspaceFolder(document, '/workspace');
		setOptions(document, {});

		await handleDocumentOpened(document);
		await handleDocumentOpened(document);

		expect(connection.windowMessages).toHaveLength(1);
		expect(logger.debug).toHaveBeenLastCalledWith(
			'Already warned about empty config in this workspace',
			{
				uri: document.uri,
			},
		);
	});

	it('if config is null (default), should not warn', async () => {
		const document = createDocument();

		setWorkspaceFolder(document, '/workspace');
		setOptions(document, null);

		await handleDocumentOpened(document);

		expect(connection.windowMessages).toHaveLength(0);
		expect(logger.debug).toHaveBeenLastCalledWith('Config is not an empty object', {
			uri: document.uri,
			configType: 'object',
			configIsNull: true,
		});
	});

	it('if config is undefined, should not warn', async () => {
		const document = createDocument();

		setWorkspaceFolder(document, '/workspace');
		setOptions(document, undefined);

		await handleDocumentOpened(document);

		expect(connection.windowMessages).toHaveLength(0);
	});

	it('if config has rules, should not warn', async () => {
		const document = createDocument();

		setWorkspaceFolder(document, '/workspace');
		setOptions(document, { rules: { 'color-no-invalid-hex': true } });

		await handleDocumentOpened(document);

		expect(connection.windowMessages).toHaveLength(0);
		expect(logger.debug).toHaveBeenLastCalledWith('Config is not an empty object', {
			uri: document.uri,
			configType: 'object',
			configIsNull: false,
		});
	});

	it('if config has extends, should not warn', async () => {
		const document = createDocument();

		setWorkspaceFolder(document, '/workspace');
		setOptions(document, { extends: 'stylelint-config-standard' });

		await handleDocumentOpened(document);

		expect(connection.windowMessages).toHaveLength(0);
	});

	it('if config is an empty object, should warn', async () => {
		const document = createDocument();

		setWorkspaceFolder(document, '/workspace');
		setOptions(document, {});

		await handleDocumentOpened(document);

		expect(connection.windowMessages).toMatchSnapshot();
		expect(logger.debug).toHaveBeenCalledWith('Detected empty config object', {
			uri: document.uri,
		});
		expect(logger.warn.mock.calls).toMatchSnapshot();
	});

	it('without showDocument support, should warn without action button', async () => {
		const document = createDocument();

		service.onInitialize({
			clientInfo: { name: 'Visual Studio Code', version: '1.109.5' },
			capabilities: {},
		} as LSP.InitializeParams);
		setWorkspaceFolder(document, '/workspace');
		setOptions(document, {});

		await handleDocumentOpened(document);

		expect(connection.windowMessages).toMatchSnapshot();
		expect(connection.windowShowDocumentCalls).toHaveLength(0);
	});

	it('in non-VS Code editor with showDocument support, should warn without action button', async () => {
		const document = createDocument();

		service.onInitialize({
			clientInfo: { name: 'Sublime Text LSP', version: '1.0.0' },
			capabilities: { window: { showDocument: { support: true } } },
		} as LSP.InitializeParams);
		setWorkspaceFolder(document, '/workspace');
		setOptions(document, {});

		await handleDocumentOpened(document);

		expect(connection.windowMessages).toMatchSnapshot();
		expect(connection.windowShowDocumentCalls).toHaveLength(0);
	});

	it('in VS Code with showDocument support and user accepts, should open settings', async () => {
		const document = createDocument();

		service.onInitialize({
			clientInfo: { name: 'Visual Studio Code', version: '1.109.5' },
			capabilities: { window: { showDocument: { support: true } } },
		} as LSP.InitializeParams);
		setWorkspaceFolder(document, '/workspace');
		setOptions(document, {});
		setShowWarningMessageResponder(async (_message, ...items) => {
			return items[0] as LSP.MessageActionItem;
		});

		await handleDocumentOpened(document);

		expect(connection.windowMessages).toMatchSnapshot();
		expect(connection.windowShowDocumentCalls).toMatchSnapshot();
	});

	it('in VS Code with showDocument support and user dismisses, should not open settings', async () => {
		const document = createDocument();

		service.onInitialize({
			clientInfo: { name: 'Visual Studio Code', version: '1.109.5' },
			capabilities: { window: { showDocument: { support: true } } },
		} as LSP.InitializeParams);
		setWorkspaceFolder(document, '/workspace');
		setOptions(document, {});
		setShowWarningMessageResponder(async () => undefined);

		await handleDocumentOpened(document);

		expect(connection.windowMessages).toMatchSnapshot();
		expect(connection.windowShowDocumentCalls).toHaveLength(0);
	});

	it('should only warn once per workspace even with multiple documents', async () => {
		const document1 = createDocument('file:///workspace/test1.css');
		const document2 = createDocument('file:///workspace/test2.css');

		setWorkspaceFolder(document1, '/workspace');
		setWorkspaceFolder(document2, '/workspace');
		setOptions(document1, {});
		setOptions(document2, {});

		await handleDocumentOpened(document1);
		await handleDocumentOpened(document2);

		expect(connection.windowMessages).toHaveLength(1);
	});

	it('should warn for different workspaces with empty config', async () => {
		const document1 = createDocument('file:///workspace1/test.css');
		const document2 = createDocument('file:///workspace2/test.css');

		setWorkspaceFolder(document1, '/workspace1');
		setWorkspaceFolder(document2, '/workspace2');
		setOptions(document1, {});
		setOptions(document2, {});

		await handleDocumentOpened(document1);
		await handleDocumentOpened(document2);

		expect(connection.windowMessages).toHaveLength(2);
	});

	it('should warn if config changes from non-empty to empty', async () => {
		const document1 = createDocument('file:///workspace/test1.css');
		const document2 = createDocument('file:///workspace/test2.css');

		setWorkspaceFolder(document1, '/workspace');
		setWorkspaceFolder(document2, '/workspace');

		setOptions(document1, { rules: { 'color-no-invalid-hex': true } });
		await handleDocumentOpened(document1);
		expect(connection.windowMessages).toHaveLength(0);

		setOptions(document2, {});
		await handleDocumentOpened(document2);

		expect(connection.windowMessages).toHaveLength(1);
	});
});
