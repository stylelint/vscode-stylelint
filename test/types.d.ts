import type vscode from 'vscode';
import type LSP from 'vscode-languageserver-protocol';
import type os from 'os';
import type cp from 'child_process';
import type fs from 'fs/promises';
import type path from 'path';
import type VSLanguageServerNode from 'vscode-languageserver/node';
import type * as ProcessesActual from '../src/utils/processes';
import type { OptionalExcept } from '../src/utils/types';
import type { TracerFn } from '../src/utils/packages';
import type * as ServerMocks from './unit/server-mocks';
import { ExtensionEvents } from '../src/extension';

declare global {
	/**
	 * The test workspace directory. Only available in end-to-end tests.
	 */
	const workspaceDir: string;

	/**
	 * Server mocks. Only available in end-to-end tests.
	 */
	const serverMocks: typeof ServerMocks;

	/**
	 * Opens a file in the editor. Only available in end-to-end tests.
	 * @param fsPath The file path.
	 */
	const openDocument: (fsPath: string) => Promise<vscode.TextEditor>;

	/**
	 * Waits until the extension emits any diagnostics for a document. Resolves
	 * to the diagnostics. Rejects if the timeout is reached. Only available in
	 * end-to-end tests.
	 * @param editorOrDocument The editor or document for which to wait.
	 * @param timeout The timeout in milliseconds. Defaults to 5000.
	 * @param interval The interval between checks in milliseconds. Defaults to
	 * 20.
	 */
	const waitForDiagnostics: (
		editorOrDocument: vscode.TextEditor | vscode.TextDocument,
		timeout?: number,
		interval?: number,
	) => Promise<vscode.Diagnostic[]>;

	/**
	 * Waits until the extension emits the specified event. If `shouldResolve`
	 * is provided, the promise will only resolve if `shouldResolve` returns
	 * true. Resolves with the event's parameters. Rejects if the timeout is
	 * reached. Only available in end-to-end tests.
	 * @param event The event name.
	 * @param shouldResolve A function that returns true if the event should
	 * resolve the promise. If not provided, the promise will resolve on any
	 * emitted event regardless of its parameters.
	 * @param timeout The timeout in milliseconds. Defaults to 5000.
	 */
	const waitForApiEvent: <T extends keyof ExtensionEvents>(
		event: T,
		shouldResolve?: (...params: Parameters<ExtensionEvents[T]>) => boolean,
		timeout?: number,
	) => Promise<Parameters<ExtensionEvents[T]>>;

	/**
	 * Types used in tests.
	 */
	namespace tests {
		type CodePart = {
			code?: LSP.Diagnostic['code'];
			codeDescription?: LSP.CodeDescription;
		};
		type Position = OptionalExcept<vscode.Position, 'line' | 'character'>;
		type Range = { start: Position; end?: Position };
		type DiagnosticRelatedInformation = {
			location: { range: Range; uri: string };
			message: string;
		};
		type Diagnostic = Omit<LSP.Diagnostic, 'range' | 'relatedInformation'> & {
			range: Range;
			relatedInformation?: DiagnosticRelatedInformation[];
		};

		namespace mocks {
			type FileSystemTree = { [path: string]: FileSystemEntry };
			type FileSystemEntry = string | FileSystemTree | Error | undefined;
			type FSPromisesModule = jest.Mocked<typeof fs> & {
				__mockFileSystem(tree: FileSystemTree): void;
			};

			interface ChildProcessWithoutNullStreams {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				on(event: string, listener: (...args: any[]) => void): this;
				on(
					event: 'exit',
					listener: (code: number | null, signal: NodeJS.Signals | null) => void,
				): this;
				on(event: 'error', listener: (err: Error) => void): this;
				removeAllListeners(event?: string): this;
				kill(signal?: string): boolean;
				stdout: NodeJS.ReadableStream;
				stderr: NodeJS.ReadableStream;
			}

			type ChildProcessModule = jest.Mocked<typeof cp> & {
				__setDelay(exitDelay?: number, stdoutDelay?: number, stderrDelay?: number): void;
				__mockProcess(
					command: string,
					args: string[],
					exitCode: number | NodeJS.Signals,
					stdout?: string,
					stderr?: string,
				): void;
				__resetMockedProcesses(): void;
			};

			type OSModule = jest.Mocked<typeof os> & {
				__mockPlatform(platform: NodeJS.Platform): void;
			};

			type PathModule = jest.Mocked<typeof path> & {
				__mockPlatform(platform?: 'posix' | 'win32'): void;
			};

			namespace VSCodeLanguageServerModule {
				type Node = jest.Mocked<typeof VSLanguageServerNode> & {
					Files: {
						__mockResolution: (
							packageName: string,
							resolver: (
								globalModulesPath?: string,
								cwd?: string,
								trace?: TracerFn,
							) => string | undefined,
						) => void;
						__resetMockedResolutions: () => void;
					};
				};
			}

			type Processes = jest.Mocked<typeof ProcessesActual> & {
				__mockProcess(command: string, args: string[], lines: string[], exitCode?: number): void;
				__resetMockedProcesses(): void;
			};
		}
	}
}
