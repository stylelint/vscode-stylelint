jest.doMock('vscode', () => ({ workspace: {}, window: {}, commands: {} }), { virtual: true });
jest.mock('vscode-languageclient/node', () => ({
	LanguageClient: jest.fn(),
	SettingMonitor: jest.fn(),
	ExecuteCommandRequest: {
		type: 'executeCommand',
	},
}));

import { EventEmitter } from 'events';
import vscode, { window } from 'vscode';
import { LanguageClient, SettingMonitor, NodeModule } from 'vscode-languageclient/node';
import {
	DidRegisterDocumentFormattingEditProviderNotificationParams,
	Notification,
} from '../../server';
import { activate } from '../extension';
import { ApiEvent } from '../types';

const mockVSCode = vscode as jest.Mocked<typeof vscode>;
const mockLanguageClient = LanguageClient as jest.MockedClass<typeof LanguageClient>;
const mockSettingMonitor = SettingMonitor as jest.MockedClass<typeof SettingMonitor>;

const mockWorkspace = {
	createFileSystemWatcher: jest.fn(),
};

const mockCommands = {
	registerCommand: jest.fn(),
};

const mockTextEditor = {
	document: {
		uri: {
			toString: () => 'file:///path/to/file.ts',
		},
		version: 1,
	},
} as vscode.TextEditor;

const mockWindow = {
	activeTextEditor: mockTextEditor,
	showErrorMessage: jest.fn(),
};

mockVSCode.workspace = mockWorkspace as unknown as typeof vscode.workspace;
mockVSCode.commands = mockCommands as unknown as typeof vscode.commands;
mockVSCode.window = mockWindow as unknown as typeof vscode.window;

const onNotification = jest.fn();
const afterOnReady = jest.fn();
const afterSendRequest = jest.fn();
const onReady = jest.fn(() => ({ then: afterOnReady }));
const sendRequest = jest.fn(() => ({ then: afterSendRequest }));
const settingMonitorStart = jest.fn();

const mockExtensionContext = {
	subscriptions: [],
} as unknown as vscode.ExtensionContext;

type ModuleServerOptions = { run: NodeModule; debug: NodeModule };

const isModuleOptions = (options: unknown): options is ModuleServerOptions =>
	Boolean((options as ModuleServerOptions)?.run?.module);

const stripPaths = <T extends unknown[]>(params: T): T => {
	if (Array.isArray(params)) {
		const serverOptions = params[1];

		if (isModuleOptions(serverOptions)) {
			serverOptions.run.module = 'mock-path';
			serverOptions.debug.module = 'mock-path';
		}
	}

	return params;
};

describe('Extension entry point', () => {
	beforeEach(() => {
		jest.clearAllMocks();

		mockVSCode.window.activeTextEditor = undefined;

		mockLanguageClient.mockReturnValue({
			onNotification,
			onReady,
			sendRequest,
		} as unknown as LanguageClient);

		mockSettingMonitor.mockReturnValue({
			start: settingMonitorStart,
		} as unknown as SettingMonitor);

		(mockExtensionContext as { subscriptions: unknown[] }).subscriptions = [];
	});

	it('should provide a public API', () => {
		const api = activate(mockExtensionContext);

		expect(api).toBeInstanceOf(EventEmitter);
	});

	it('should create a language client', () => {
		activate(mockExtensionContext);

		expect(mockLanguageClient).toHaveBeenCalled();
		expect(stripPaths(mockLanguageClient.mock.calls[0])).toMatchSnapshot();
	});

	it('should watch for changes to Stylelint configuration files', () => {
		activate(mockExtensionContext);

		expect(mockWorkspace.createFileSystemWatcher).toHaveBeenCalled();
		expect(mockWorkspace.createFileSystemWatcher.mock.calls[0]).toMatchInlineSnapshot(`
		Array [
		  "**/{.stylelintrc{,.js,.json,.yaml,.yml},stylelint.config.js,.stylelintignore}",
		]
	`);
	});

	it('should register an auto-fix command', () => {
		const disposable = { dispose: () => undefined };

		mockCommands.registerCommand.mockReturnValueOnce(disposable);

		activate(mockExtensionContext);

		const { subscriptions } = mockExtensionContext;

		expect(mockCommands.registerCommand).toHaveBeenCalled();
		// cspell:disable
		expect(mockCommands.registerCommand.mock.calls[0]).toMatchInlineSnapshot(`
		Array [
		  "stylelint.executeAutofix",
		  [Function],
		]
	`);
		// cspell:enable
		expect(subscriptions).toContain(disposable);
	});

	it('with an active text editor, should send auto-fix commands to the language server', () => {
		window.activeTextEditor = mockTextEditor;

		activate(mockExtensionContext);

		mockCommands.registerCommand.mock.calls[0][1](undefined);

		expect(sendRequest).toHaveBeenCalledTimes(1);
		expect(sendRequest.mock.calls[0]).toMatchSnapshot();
		expect(afterSendRequest).toHaveBeenCalledTimes(1);
		expect(afterSendRequest.mock.calls[0][0]).toBeUndefined();
		expect(mockWindow.showErrorMessage).not.toHaveBeenCalled();
	});

	it('without an active text editor, should not send auto-fix commands to the language server', () => {
		window.activeTextEditor = undefined;

		activate(mockExtensionContext);

		mockCommands.registerCommand.mock.calls[0][1](undefined);

		expect(sendRequest).not.toHaveBeenCalled();
		expect(afterSendRequest).not.toHaveBeenCalled();
		expect(mockWindow.showErrorMessage).not.toHaveBeenCalled();
	});

	it('should show an error message if sending the command request fails', () => {
		window.activeTextEditor = mockTextEditor;

		activate(mockExtensionContext);

		mockCommands.registerCommand.mock.calls[0][1](undefined);
		afterSendRequest.mock.calls[0][1](undefined, new Error());

		expect(sendRequest).toHaveBeenCalledTimes(1);
		expect(afterSendRequest).toHaveBeenCalledTimes(1);
		expect(mockWindow.showErrorMessage).toHaveBeenCalledTimes(1);
		expect(mockWindow.showErrorMessage.mock.calls[0]).toMatchInlineSnapshot(`
		Array [
		  "Failed to apply Stylelint fixes to the document. Please consider opening an issue with steps to reproduce.",
		]
	`);
	});

	it('should monitor settings', () => {
		const disposable = { dispose: () => undefined };

		settingMonitorStart.mockReturnValueOnce(disposable);

		activate(mockExtensionContext);

		const { subscriptions } = mockExtensionContext;

		const mockLanguageClientInstance = mockLanguageClient.mock.results[0].value;

		expect(mockSettingMonitor).toHaveBeenCalled();
		expect(mockSettingMonitor.mock.calls[0][0]).toBe(mockLanguageClientInstance);
		expect(mockSettingMonitor.mock.calls[0][1]).toBe('stylelint.enable');
		expect(settingMonitorStart).toHaveBeenCalled();
		expect(subscriptions).toContain(disposable);
	});

	it('should listen for the DidRegisterDocumentFormattingEditProvider notification', () => {
		activate(mockExtensionContext);

		afterOnReady.mock.calls[0][0]();

		expect(onReady).toHaveBeenCalled();
		expect(onNotification).toHaveBeenCalled();
		expect(onNotification.mock.calls[0][0]).toBe(
			Notification.DidRegisterDocumentFormattingEditProvider,
		);
		expect(onNotification.mock.calls[0][1]).toBeInstanceOf(Function);
	});

	it('should emit the DidRegisterDocumentFormattingEditProvider event when the DidRegisterDocumentFormattingEditProvider notification is received', async () => {
		const api = activate(mockExtensionContext);

		const promise = new Promise<DidRegisterDocumentFormattingEditProviderNotificationParams>(
			(resolve) => {
				api.on(ApiEvent.DidRegisterDocumentFormattingEditProvider, resolve);
			},
		);

		const params: DidRegisterDocumentFormattingEditProviderNotificationParams = {
			uri: 'file:///foo.css',
			options: {
				documentSelector: [{ scheme: 'file', pattern: '/foo.css' }],
			},
		};

		afterOnReady.mock.calls[0][0]();
		onNotification.mock.calls[0][1](params);

		await expect(promise).resolves.toStrictEqual(params);
	});
});
