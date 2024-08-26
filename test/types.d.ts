import type vscode from 'vscode';
import type LSP from 'vscode-languageserver-protocol';
import type os from 'os';
import type cp from 'child_process';
import type fs from 'fs/promises';
import type path from 'path';
// eslint-disable-next-line n/no-missing-import
import type VSLanguageServerNode from 'vscode-languageserver/node';
import type * as ProcessesActual from '../src/utils/processes';
import type { OptionalExcept } from '../src/utils/types';
import type { TracerFn } from '../src/utils/packages/index';
import type * as ServerMocks from './unit/server-mocks';
import type { ConnectionManager as ConnectionManagerConstructor } from './integration/connection-manager';
import type { ExtensionEvents } from '../src/extension/index';

declare global {
	/**
	 * The test workspace directory. Only available in end-to-end tests.
	 */
	//const workspaceDir: string;

	/**
	 * Server mocks. Only available in unit tests.
	 */
	const serverMocks: typeof ServerMocks;

	/**
	 * Connection manager. Only available in integration tests.
	 */
	const ConnectionManager: typeof ConnectionManagerConstructor;

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
