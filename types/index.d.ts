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
