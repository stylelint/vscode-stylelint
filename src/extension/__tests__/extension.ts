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

const start = jest.fn();
const stop = jest.fn();
const onNotification = jest.fn();
const onReady = jest.fn();
const sendRequest = jest.fn();
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
		jest.resetAllMocks();

		mockVSCode.window.activeTextEditor = undefined;

		start.mockImplementation(async () => undefined);
		onReady.mockImplementation(async () => undefined);
		sendRequest.mockImplementation(async () => undefined);

		mockLanguageClient.mockReturnValue({
			onNotification,
			onReady,
			sendRequest,
			start,
			stop,
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

	it('with an active text editor, should send auto-fix commands to the language server', async () => {
		window.activeTextEditor = mockTextEditor;

		activate(mockExtensionContext);

		await mockCommands.registerCommand.mock.calls[0][1](undefined);

		expect(sendRequest).toHaveBeenCalledTimes(1);
		expect(sendRequest.mock.calls[0]).toMatchSnapshot();
		expect(mockWindow.showErrorMessage).not.toHaveBeenCalled();
	});

	it('without an active text editor, should not send auto-fix commands to the language server', async () => {
		window.activeTextEditor = undefined;

		activate(mockExtensionContext);

		await mockCommands.registerCommand.mock.calls[0][1](undefined);

		expect(sendRequest).not.toHaveBeenCalled();
		expect(mockWindow.showErrorMessage).not.toHaveBeenCalled();
	});

	it('should show an error message if sending the command request fails', async () => {
		window.activeTextEditor = mockTextEditor;

		activate(mockExtensionContext);

		sendRequest.mockRejectedValueOnce(new Error('mock error'));

		await mockCommands.registerCommand.mock.calls[0][1](undefined);

		expect(sendRequest).toHaveBeenCalledTimes(1);
		expect(mockWindow.showErrorMessage).toHaveBeenCalledTimes(1);
		expect(mockWindow.showErrorMessage.mock.calls[0]).toMatchInlineSnapshot(`
		Array [
		  "Failed to apply Stylelint fixes to the document. Please consider opening an issue with steps to reproduce.",
		]
	`);
	});

	it('should register a restart server command', () => {
		const disposable = { dispose: () => undefined };

		mockCommands.registerCommand.mockReturnValue(disposable);

		activate(mockExtensionContext);

		const { subscriptions } = mockExtensionContext;

		expect(mockCommands.registerCommand).toHaveBeenCalled();
		expect(mockCommands.registerCommand.mock.calls[1]).toMatchInlineSnapshot(`
		Array [
		  "stylelint.restart",
		  [Function],
		]
	`);
		expect(subscriptions).toContain(disposable);
	});

	it('should restart the language server', async () => {
		activate(mockExtensionContext);

		await mockCommands.registerCommand.mock.calls[1][1]();

		expect(stop).toHaveBeenCalled();
		expect(start).toHaveBeenCalled();
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

	it('should listen for the DidRegisterCodeActionRequestHandler notification', async () => {
		activate(mockExtensionContext);

		await new Promise((resolve) => setImmediate(resolve));

		expect(onReady).toHaveBeenCalled();
		expect(onNotification).toHaveBeenCalled();
		expect(onNotification.mock.calls[0][0]).toBe(Notification.DidRegisterCodeActionRequestHandler);
		expect(onNotification.mock.calls[0][1]).toBeInstanceOf(Function);
	});

	it('should set codeActionReady to true when the DidRegisterCodeActionRequestHandler notification is received', async () => {
		const api = activate(mockExtensionContext);

		await new Promise((resolve) => setImmediate(resolve));

		onNotification.mock.calls[0][1]();

		expect(api.codeActionReady).toBe(true);
	});

	it('should listen for the DidRegisterDocumentFormattingEditProvider notification', async () => {
		activate(mockExtensionContext);

		await new Promise((resolve) => setImmediate(resolve));

		expect(onReady).toHaveBeenCalled();
		expect(onNotification).toHaveBeenCalled();
		expect(onNotification.mock.calls[1][0]).toBe(
			Notification.DidRegisterDocumentFormattingEditProvider,
		);
		expect(onNotification.mock.calls[1][1]).toBeInstanceOf(Function);
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

		await new Promise((resolve) => setImmediate(resolve));

		onNotification.mock.calls[1][1](params);

		await expect(promise).resolves.toStrictEqual(params);
	});

	it('should listen for the DidResetConfiguration notification', async () => {
		activate(mockExtensionContext);

		await new Promise((resolve) => setImmediate(resolve));

		expect(onReady).toHaveBeenCalled();
		expect(onNotification).toHaveBeenCalled();
		expect(onNotification.mock.calls[2][0]).toBe(Notification.DidResetConfiguration);
		expect(onNotification.mock.calls[2][1]).toBeInstanceOf(Function);
	});

	it('should emit the DidResetConfiguration event when the DidResetConfiguration notification is received', async () => {
		const api = activate(mockExtensionContext);

		const promise = new Promise<void>((resolve) => {
			api.on(ApiEvent.DidResetConfiguration, resolve);
		});

		await new Promise((resolve) => setImmediate(resolve));

		onNotification.mock.calls[2][1]();

		await expect(promise).resolves.toBeUndefined();
	});

	it('should show an error message if registering notifications fails', async () => {
		onNotification.mockImplementation((): void => {
			throw new Error('Problem!');
		});

		activate(mockExtensionContext);

		await new Promise((resolve) => setImmediate(resolve));

		onNotification.mockImplementation((): void => {
			throw 'String problem!';
		});

		activate(mockExtensionContext);

		await new Promise((resolve) => setImmediate(resolve));

		expect(mockWindow.showErrorMessage).toHaveBeenCalledTimes(2);
		expect(mockWindow.showErrorMessage.mock.calls[0]).toMatchInlineSnapshot(`
		Array [
		  "Stylelint: Problem!",
		]
	`);
		expect(mockWindow.showErrorMessage.mock.calls[1]).toMatchInlineSnapshot(`
		Array [
		  "Stylelint: String problem!",
		]
	`);
	});

	it('should show an error message if restarting the language server fails', async () => {
		activate(mockExtensionContext);

		await new Promise((resolve) => setImmediate(resolve));

		onReady.mockImplementation((): void => {
			throw new Error('Problem!');
		});

		await mockCommands.registerCommand.mock.calls[1][1]();

		onReady.mockImplementation((): void => {
			throw 'String problem!';
		});

		await mockCommands.registerCommand.mock.calls[1][1]();

		expect(mockWindow.showErrorMessage).toHaveBeenCalledTimes(2);
		expect(mockWindow.showErrorMessage.mock.calls[0]).toMatchInlineSnapshot(`
		Array [
		  "Stylelint: Problem!",
		]
	`);
		expect(mockWindow.showErrorMessage.mock.calls[1]).toMatchInlineSnapshot(`
		Array [
		  "Stylelint: String problem!",
		]
	`);
	});
});
