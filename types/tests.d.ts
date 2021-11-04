/**
 * Types used in tests.
 */
declare namespace tests {
	type CodePart = {
		code?: lsp.Diagnostic['code'];
		codeDescription?: lsp.CodeDescription;
	};
	type Position = OptionalExcept<vscode.Position, 'line' | 'character'>;
	type Range = { start: Position; end?: Position };
	type DiagnosticRelatedInformation = {
		location: { range: Range; uri: string };
		message: string;
	};
	type Diagnostic = Omit<lsp.Diagnostic, 'range' | 'relatedInformation'> & {
		range: Range;
		relatedInformation?: DiagnosticRelatedInformation[];
	};

	namespace mocks {
		type FileSystemTree = { [path: string]: FileSystemEntry };
		type FileSystemEntry = string | FileSystemTree | Error | undefined;
		type FSPromisesModule = jest.Mocked<typeof import('fs/promises')> & {
			__mockFileSystem(tree: FileSystemTree): void;
		};

		interface ChildProcessWithoutNullStreams {
			on(event: string, listener: (...args: any[]) => void): this;
			on(event: 'exit', listener: (code: number, signal?: string) => void): this;
			on(event: 'error', listener: (err: Error) => void): this;
			removeAllListeners(event?: string): this;
			kill(signal?: string): void;
			stdout: NodeJS.ReadableStream;
			stderr: NodeJS.ReadableStream;
		}

		type ChildProcessModule = jest.Mocked<typeof import('child_process')> & {
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

		type OSModule = jest.Mocked<typeof import('os')> & {
			__mockPlatform(platform: NodeJS.Platform): void;
		};

		type PathModule = jest.Mocked<typeof import('path')> & {
			__mockPlatform(platform?: 'posix' | 'win32'): void;
		};

		namespace VSCodeLanguageServerModule {
			type Node = jest.Mocked<typeof import('vscode-languageserver/node')> & {
				Files: {
					__mockResolution: (
						packageName: string,
						resolver: (globalModulesPath?: string, cwd?: string, trace?: TracerFn) => any,
					) => void;
					__resetMockedResolutions: () => void;
				};
			};
		}

		type Processes = jest.Mocked<typeof import('../src/utils/processes')> & {
			__mockProcess(command: string, args: string[], lines: string[], exitCode?: number): void;
			__resetMockedProcesses(): void;
		};
	}
}
