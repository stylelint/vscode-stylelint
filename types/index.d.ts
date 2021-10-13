// Make module namespaces available globally
import postcss = imports.postcss;
import stylelint = imports.stylelint;
import vscode = imports.vscode;
import vscodeLanguageServer = imports.vscodeLanguageServer;
import vscodeLanguageServerTextDocument = imports.vscodeLanguageServerTextDocument;
import vscodeLanguageServerTypes = imports.vscodeLanguageServerTypes;

/**
 * Language Server Protocol and VS Code language server types.
 */
declare namespace lsp {
	export import CodeDescription = vscodeLanguageServer.CodeDescription;
	export import CompletionItem = vscodeLanguageServer.CompletionItem;
	export import CompletionParams = vscodeLanguageServer.CompletionParams;
	export import Connection = vscodeLanguageServer.Connection;
	export import Diagnostic = vscodeLanguageServer.Diagnostic;
	export import DiagnosticRelatedInformation = vscodeLanguageServer.DiagnosticRelatedInformation;
	export import DiagnosticSeverity = vscodeLanguageServer.DiagnosticSeverity;
	export import Disposable = vscodeLanguageServer.Disposable;
	export import DocumentUri = vscodeLanguageServer.DocumentUri;
	export import FormattingOptions = vscodeLanguageServer.FormattingOptions;
	export import TextDocument = vscodeLanguageServerTextDocument.TextDocument;
	export import URI = vscodeLanguageServerTypes.URI;
}

type OptionalExcept<T extends Record<any, any>, K extends keyof T> = Pick<T, K> &
	Partial<Pick<T, K>>;

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
		type FSPromisesModule = typeof import('fs/promises') & {
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

		type ChildProcessModule = typeof import('child_process') & {
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

		type OSModule = typeof import('os') & {
			__mockPlatform(platform: NodeJS.Platform): void;
		};

		type PathModule = typeof import('path') & {
			__mockPlatform(platform: 'posix' | 'win32'): void;
		};

		type Processes = typeof import('../src/utils/processes') & {
			runProcessFindLine: jest.Mock<typeof import('../src/utils/processes').runProcessFindLine>;
			__mockProcess(command: string, args: string[], lines: string[], exitCode?: number): void;
			__resetMockedProcesses(): void;
		};
	}
}

type PackageManager = 'npm' | 'yarn' | 'pnpm';

type InvalidOptionError = Error & { reasons: string[] };

// TODO: Create type upstream
/**
 * A Stylelint configuration error. Taken from
 * https://github.com/stylelint/stylelint/blob/551dcb5/lib/utils/configurationError.js
 */
type ConfigurationError = Error & { code: 78 };

type RuleDocUrlProvider = (rule: string) => lsp.URI | null | undefined;

type TracerFn = (message: string, verbose?: string) => void;

type GlobalPathResolver = {
	resolve: (packageManager: PackageManager, trace?: TracerFn) => Promise<string | undefined>;
};

type GlobalPathResolverCache = {
	[packageManager: string]: string | undefined;
};

type DisableReport = {
	diagnostic: lsp.Diagnostic;
	range: stylelint.DisableReportRange;
};

type StylelintVSCodeOptions = {
	connection?: lsp.Connection;
	packageManager?: PackageManager;
	stylelintPath?: string;
};

type StylelintVSCodeResult = {
	diagnostics: lsp.Diagnostic[];
	output?: string;
	needlessDisables?: DisableReport[];
	invalidScopeDisables?: DisableReport[];
};
