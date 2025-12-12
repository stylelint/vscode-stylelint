import { EventEmitter } from 'events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtensionContext, TextEditor } from 'vscode';
import type { LanguageClient, NodeModule, SettingMonitor } from 'vscode-languageclient/node';
import {
	DidRegisterDocumentFormattingEditProviderNotificationParams,
	Notification,
} from '../../server/index.js';
import { activate, deactivate } from '../extension.js';
import { extensionTokens } from '../di-tokens.js';
import { ApiEvent } from '../types.js';

type VSCodeWorkspace = (typeof import('vscode'))['workspace'];
type VSCodeCommands = (typeof import('vscode'))['commands'];
type VSCodeWindow = (typeof import('vscode'))['window'];
type LanguageClientModule = typeof import('vscode-languageclient/node');
type ExtensionToken = (typeof extensionTokens)[keyof typeof extensionTokens];
type ExtensionOverrideEntry = [ExtensionToken, unknown];

const mockTextEditor = {
	document: {
		uri: {
			toString: () => 'file:///path/to/file.ts',
		},
		version: 1,
	},
} as unknown as TextEditor;

const start = vi.fn();
const stop = vi.fn();
const onNotification = vi.fn();
const sendRequest = vi.fn();
const settingMonitorStart = vi.fn();

const mockExtensionContext = {
	subscriptions: [],
} as unknown as ExtensionContext;

let mockWorkspace: VSCodeWorkspace;
let mockCommands: VSCodeCommands;
let mockWindow: VSCodeWindow;
let mockLanguageClient: ReturnType<typeof vi.fn>;
let mockSettingMonitor: ReturnType<typeof vi.fn>;
let languageClientInstance: LanguageClient;
let moduleOverrides: Iterable<ExtensionOverrideEntry>;
let registerCommandMock: ReturnType<typeof vi.fn>;
let fileWatcherMock: ReturnType<typeof vi.fn>;
let showErrorMessageMock: ReturnType<typeof vi.fn>;

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
		vi.resetAllMocks();

		fileWatcherMock = vi.fn((pattern: string) => ({ pattern }));
		mockWorkspace = {
			createFileSystemWatcher: fileWatcherMock,
			workspaceFolders: [],
		} as unknown as VSCodeWorkspace;

		registerCommandMock = vi.fn();
		mockCommands = {
			registerCommand: registerCommandMock,
		} as unknown as VSCodeCommands;

		showErrorMessageMock = vi.fn(async () => undefined);
		mockWindow = {
			activeTextEditor: undefined,
			showErrorMessage: showErrorMessageMock,
			showInformationMessage: vi.fn(),
			showWarningMessage: vi.fn(),
		} as unknown as VSCodeWindow;

		languageClientInstance = {
			onNotification,
			sendRequest,
			start,
			stop,
		} as unknown as LanguageClient;

		// eslint-disable-next-line prefer-arrow-callback -- Must be constructable via `new`
		mockLanguageClient = vi.fn(function MockLanguageClient(
			_name: string,
			_serverOptions: unknown,
			_clientOptions: unknown,
		) {
			return languageClientInstance;
		});
		// eslint-disable-next-line prefer-arrow-callback -- Must be constructable via `new`
		mockSettingMonitor = vi.fn(function MockSettingMonitor() {
			return {
				start: settingMonitorStart,
			} as unknown as SettingMonitor;
		});

		const overrides: ExtensionOverrideEntry[] = [
			[extensionTokens.workspace, mockWorkspace],
			[extensionTokens.commands, mockCommands],
			[extensionTokens.window, mockWindow],
			[
				extensionTokens.languageClientModule,
				{
					LanguageClient: mockLanguageClient as unknown as LanguageClientModule['LanguageClient'],
					SettingMonitor: mockSettingMonitor as unknown as LanguageClientModule['SettingMonitor'],
				} as LanguageClientModule,
			],
		];

		moduleOverrides = new Map<ExtensionToken, unknown>(overrides);

		start.mockImplementation(async () => undefined);
		sendRequest.mockImplementation(async () => undefined);
		mockWindow.activeTextEditor = undefined;
		(mockExtensionContext as { subscriptions: unknown[] }).subscriptions = [];
	});

	afterEach(async () => {
		try {
			await deactivate();
		} catch {
			// Ignore errors during cleanup to keep individual test expectations isolated.
		}
	});

	it('should provide a public API', async () => {
		const api = await activate(mockExtensionContext, moduleOverrides);

		expect(api).toBeInstanceOf(EventEmitter);
	});

	it('should create a language client', async () => {
		await activate(mockExtensionContext, moduleOverrides);

		expect(mockLanguageClient).toHaveBeenCalled();
		expect(stripPaths(mockLanguageClient.mock.calls[0])).toMatchSnapshot();
	});

	it('should watch for changes to Stylelint configuration files', async () => {
		await activate(mockExtensionContext, moduleOverrides);

		expect(fileWatcherMock).toHaveBeenCalledTimes(3);
		expect(fileWatcherMock.mock.calls[0]).toEqual([
			'**/.stylelintrc{,.js,.cjs,.mjs,.json,.yaml,.yml}',
		]);
		expect(fileWatcherMock.mock.calls[1]).toEqual(['**/stylelint.config.{js,cjs,mjs}']);
		expect(fileWatcherMock.mock.calls[2]).toEqual(['**/.stylelintignore']);
	});

	it('should register an auto-fix command', async () => {
		const disposable = { dispose: () => undefined };

		registerCommandMock.mockReturnValueOnce(disposable);

		await activate(mockExtensionContext, moduleOverrides);

		const { subscriptions } = mockExtensionContext;

		expect(registerCommandMock).toHaveBeenCalled();
		// cspell:disable
		expect(registerCommandMock.mock.calls[0]).toMatchObject([
			'stylelint.executeAutofix',
			expect.any(Function),
		]);
		// cspell:enable
		expect(subscriptions).toContain(disposable);
	});

	it('with an active text editor, should send auto-fix commands to the language server', async () => {
		mockWindow.activeTextEditor = mockTextEditor;

		await activate(mockExtensionContext, moduleOverrides);

		await registerCommandMock.mock.calls[0][1](undefined);

		expect(sendRequest).toHaveBeenCalledTimes(1);
		expect(sendRequest.mock.calls[0]).toMatchSnapshot();
		expect(showErrorMessageMock).not.toHaveBeenCalled();
	});

	it('without an active text editor, should not send auto-fix commands to the language server', async () => {
		mockWindow.activeTextEditor = undefined;

		await activate(mockExtensionContext, moduleOverrides);

		await registerCommandMock.mock.calls[0][1](undefined);

		expect(sendRequest).not.toHaveBeenCalled();
		expect(showErrorMessageMock).not.toHaveBeenCalled();
	});

	it('should show an error message if sending the command request fails', async () => {
		mockWindow.activeTextEditor = mockTextEditor;

		await activate(mockExtensionContext, moduleOverrides);

		sendRequest.mockRejectedValueOnce(new Error('mock error'));

		await registerCommandMock.mock.calls[0][1](undefined);

		expect(sendRequest).toHaveBeenCalledTimes(1);
		expect(showErrorMessageMock).toHaveBeenCalledTimes(1);
		expect(showErrorMessageMock.mock.calls[0]).toEqual([
			'Failed to apply Stylelint fixes to the document. Please consider opening an issue with steps to reproduce.',
		]);
	});

	it('should register a restart server command', async () => {
		const disposable = { dispose: () => undefined };

		registerCommandMock.mockReturnValue(disposable);

		await activate(mockExtensionContext, moduleOverrides);

		const { subscriptions } = mockExtensionContext;

		expect(registerCommandMock).toHaveBeenCalled();
		expect(registerCommandMock.mock.calls[1]).toMatchObject([
			'stylelint.restart',
			expect.any(Function),
		]);
		expect(subscriptions).toContain(disposable);
	});

	it('should restart the language server', async () => {
		await activate(mockExtensionContext, moduleOverrides);

		await registerCommandMock.mock.calls[1][1]();

		expect(stop).toHaveBeenCalled();
		expect(start).toHaveBeenCalled();
	});

	it('should monitor settings', async () => {
		const disposable = { dispose: () => undefined };

		settingMonitorStart.mockReturnValueOnce(disposable);

		await activate(mockExtensionContext, moduleOverrides);

		const { subscriptions } = mockExtensionContext;

		const mockLanguageClientInstance = mockLanguageClient.mock.results[0].value;

		expect(mockSettingMonitor).toHaveBeenCalled();
		expect(mockSettingMonitor.mock.calls[0][0]).toBe(mockLanguageClientInstance);
		expect(mockSettingMonitor.mock.calls[0][1]).toBe('stylelint.enable');
		expect(settingMonitorStart).toHaveBeenCalled();
		expect(subscriptions).toContain(disposable);
	});

	it('should listen for the DidRegisterCodeActionRequestHandler notification', async () => {
		await activate(mockExtensionContext, moduleOverrides);

		await new Promise((resolve) => setImmediate(resolve));

		expect(onNotification).toHaveBeenCalled();
		expect(onNotification.mock.calls[0][0]).toBe(Notification.DidRegisterCodeActionRequestHandler);
		expect(onNotification.mock.calls[0][1]).toBeInstanceOf(Function);
	});

	it('should set codeActionReady to true when the DidRegisterCodeActionRequestHandler notification is received', async () => {
		const api = await activate(mockExtensionContext, moduleOverrides);

		await new Promise((resolve) => setImmediate(resolve));

		onNotification.mock.calls[0][1]();

		expect(api.codeActionReady).toBe(true);
	});

	it('should listen for the DidRegisterDocumentFormattingEditProvider notification', async () => {
		await activate(mockExtensionContext, moduleOverrides);

		await new Promise((resolve) => setImmediate(resolve));

		expect(onNotification).toHaveBeenCalled();
		expect(onNotification.mock.calls[1][0]).toBe(
			Notification.DidRegisterDocumentFormattingEditProvider,
		);
		expect(onNotification.mock.calls[1][1]).toBeInstanceOf(Function);
	});

	it('should emit the DidRegisterDocumentFormattingEditProvider event when the DidRegisterDocumentFormattingEditProvider notification is received', async () => {
		const api = await activate(mockExtensionContext, moduleOverrides);

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
		await activate(mockExtensionContext, moduleOverrides);

		await new Promise((resolve) => setImmediate(resolve));

		expect(onNotification).toHaveBeenCalled();
		expect(onNotification.mock.calls[2][0]).toBe(Notification.DidResetConfiguration);
		expect(onNotification.mock.calls[2][1]).toBeInstanceOf(Function);
	});

	it('should emit the DidResetConfiguration event when the DidResetConfiguration notification is received', async () => {
		const api = await activate(mockExtensionContext, moduleOverrides);

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

		await activate(mockExtensionContext, moduleOverrides);

		await new Promise((resolve) => setImmediate(resolve));

		await deactivate();

		onNotification.mockImplementation((): void => {
			throw 'String problem!'; // eslint-disable-line @typescript-eslint/only-throw-error
		});

		await activate(mockExtensionContext, moduleOverrides);

		await new Promise((resolve) => setImmediate(resolve));

		expect(showErrorMessageMock).toHaveBeenCalledTimes(2);
		expect(showErrorMessageMock.mock.calls[0]).toEqual(['Stylelint: Problem!']);
		expect(showErrorMessageMock.mock.calls[1]).toEqual(['Stylelint: String problem!']);
	});

	it('should show an error message if restarting the language server fails', async () => {
		await activate(mockExtensionContext, moduleOverrides);

		await new Promise((resolve) => setImmediate(resolve));

		start.mockImplementation((): void => {
			throw new Error('Problem!');
		});

		await registerCommandMock.mock.calls[1][1]();

		start.mockImplementation((): void => {
			throw 'String problem!'; // eslint-disable-line @typescript-eslint/only-throw-error
		});

		await registerCommandMock.mock.calls[1][1]();

		expect(showErrorMessageMock).toHaveBeenCalledTimes(2);
		expect(showErrorMessageMock.mock.calls[0]).toEqual(['Stylelint: Problem!']);
		expect(showErrorMessageMock.mock.calls[1]).toEqual(['Stylelint: String problem!']);
	});

	it('should stop language client on deactivate', async () => {
		await activate(mockExtensionContext, moduleOverrides);
		await deactivate();

		expect(stop).toHaveBeenCalledTimes(1);
	});

	it('should show error message when deactivate fails to stop the client', async () => {
		stop.mockImplementation(() => {
			throw new Error('foo');
		});

		await activate(mockExtensionContext, moduleOverrides);

		try {
			await deactivate();
		} catch {
			/* empty */
		}

		expect(showErrorMessageMock).toHaveBeenCalledTimes(1);
		expect(showErrorMessageMock).toHaveBeenCalledWith(
			'error stopping stylelint language server: foo',
		);
	});

	it('should show unknown error message when deactivate fails to stop the client', async () => {
		stop.mockImplementation(() => {
			throw undefined; // eslint-disable-line @typescript-eslint/only-throw-error
		});

		await activate(mockExtensionContext, moduleOverrides);

		try {
			await deactivate();
		} catch {
			/* empty */
		}

		expect(showErrorMessageMock).toHaveBeenCalledTimes(1);
		expect(showErrorMessageMock).toHaveBeenCalledWith(
			'error stopping stylelint language server: unknown',
		);
	});
});
