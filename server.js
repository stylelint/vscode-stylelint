'use strict';

const { join, parse, isAbsolute } = require('path');

const diff = require('fast-diff');
const parseUri = require('vscode-uri').URI.parse;
const pathIsInside = require('path-is-inside');
const pkgDir = require('pkg-dir').sync;
const stylelintVSCode = require('./lib/stylelint-vscode');
const {
	createConnection,
	ProposedFeatures,
	TextDocuments,
	TextDocumentSyncKind,
	TextEdit,
	Range,
	Position,
	WorkspaceChange,
	CodeActionKind,
	TextDocumentEdit,
	CodeAction,
	CompletionItemKind,
	DiagnosticCode,
	MarkupKind,
	InsertTextFormat,
	DocumentFormattingRequest,
} = require('vscode-languageserver');
const { TextDocument } = require('vscode-languageserver-textdocument');

/**
 * @typedef { import('vscode-languageserver').DocumentUri } DocumentUri
 * @typedef { import('vscode-languageserver').Diagnostic } Diagnostic
 * @typedef { import('vscode-languageserver').CompletionItem } CompletionItem
 * @typedef { import('vscode-languageserver').CompletionParams } CompletionParams
 * @typedef { import('./lib/stylelint-vscode').DisableReportRange } DisableReportRange
 * @typedef { import('stylelint').StylelintConfig } StylelintConfiguration
 * @typedef { import('stylelint').StylelintStandaloneOptions } BaseStylelintLinterOptions
 * @typedef { Partial<BaseStylelintLinterOptions> } StylelintLinterOptions
 * @typedef { "npm" | "yarn" | "pnpm" } PackageManager
 * @typedef { import('./lib/stylelint-vscode').StylelintVSCodeOption } StylelintVSCodeOption
 * @typedef { Error & { reasons: string[] } } InvalidOptionError
 * @typedef { Error & { code: 78 } } ConfigurationError
 */

const CommandIds = {
	applyAutoFix: 'stylelint.applyAutoFix',
};

const StylelintSourceFixAll = `${CodeActionKind.SourceFixAll}.stylelint`;

/** @type {StylelintConfiguration} */
let config;
/** @type {string} */
let configFile;
/** @type {StylelintConfiguration} */
let configOverrides;
/** @type {string} */
let configBasedir;
/** @type {PackageManager} */
let packageManager;
/** @type { "css-in-js" | "html" | "less" | "markdown" | "sass" | "scss" | "sugarss" | undefined } */
let syntax;
/** @type {string} */
let customSyntax;
/** @type {boolean} */
let ignoreDisables;
/** @type {boolean} */
let reportNeedlessDisables;
/** @type {boolean} */
let reportInvalidScopeDisables;
/** @type {string} */
let stylelintPath;
/** @type {string[]} */
let validateLanguages;
/** @type {string[]} */
let snippetLanguages;

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

/**
 * @type {Map<DocumentUri, Diagnostic[]>}
 */
const documentDiagnostics = new Map();
/**
 * @type {Map<DocumentUri, ({ diagnostic: Diagnostic, range: DisableReportRange })[]>}
 */
const needlessDisableReports = new Map();
/**
 * @type {Map<DocumentUri, ({ diagnostic: Diagnostic, range: DisableReportRange })[]>}
 */
const invalidScopeDisableReports = new Map();

/**
 *
 * @param {TextDocument} document
 * @param {StylelintLinterOptions} baseOptions
 * @returns {Promise<StylelintLinterOptions>}
 */
async function buildStylelintOptions(document, baseOptions = {}) {
	const options = { ...baseOptions };
	const workspaceFolder = await getWorkspaceFolder(document);

	if (config) {
		options.config = config;
	}

	if (configFile) {
		options.configFile = workspaceFolder
			? configFile.replace(/\$\{workspaceFolder\}/gu, workspaceFolder)
			: configFile;
	}

	if (configOverrides) {
		options.configOverrides = configOverrides;
	}

	if (ignoreDisables) {
		options.ignoreDisables = ignoreDisables;
	}

	if (reportNeedlessDisables) {
		options.reportNeedlessDisables = reportNeedlessDisables;
	}

	if (reportInvalidScopeDisables) {
		options.reportInvalidScopeDisables = reportInvalidScopeDisables;
	}

	if (syntax) {
		options.syntax = syntax;
	}

	if (customSyntax) {
		options.customSyntax = workspaceFolder
			? customSyntax.replace(/\$\{workspaceFolder\}/gu, workspaceFolder)
			: customSyntax;
	}

	if (configBasedir) {
		if (isAbsolute(configBasedir)) {
			options.configBasedir = configBasedir;
		} else {
			options.configBasedir = join(workspaceFolder || '', configBasedir);
		}
	}

	const documentPath = parseUri(document.uri).fsPath;

	if (documentPath) {
		if (workspaceFolder && pathIsInside(documentPath, workspaceFolder)) {
			options.ignorePath = join(workspaceFolder, '.stylelintignore');
		}

		if (options.ignorePath === undefined) {
			options.ignorePath = join(
				pkgDir(documentPath) || parse(documentPath).root,
				'.stylelintignore',
			);
		}
	}

	return options;
}

/**
 * @param {TextDocument} document
 * @returns {Promise<StylelintVSCodeOption>}
 */
async function buildStylelintVSCodeOptions(document) {
	/** @type {StylelintVSCodeOption} */
	const options = { connection, packageManager };

	if (stylelintPath) {
		if (isAbsolute(stylelintPath)) {
			options.stylelintPath = stylelintPath;
		} else {
			const workspaceFolder = await getWorkspaceFolder(document);

			options.stylelintPath = join(workspaceFolder || '', stylelintPath);
		}
	}

	return options;
}

/**
 * @param {unknown} err
 * @returns {void}
 */
function handleError(err) {
	if (!(err instanceof Error)) {
		connection.window.showErrorMessage(String(err).replace(/\n/gu, ' '));

		return;
	}

	if (/** @type {InvalidOptionError} */ (err)?.reasons) {
		for (const reason of /** @type {InvalidOptionError} */ (err)?.reasons) {
			connection.window.showErrorMessage(`stylelint: ${reason}`);
		}

		return;
	}

	// https://github.com/stylelint/stylelint/blob/10.0.1/lib/utils/configurationError.js#L10
	if (/** @type {ConfigurationError} */ (err)?.code === 78) {
		connection.window.showErrorMessage(`stylelint: ${err.message}`);

		return;
	}

	connection.window.showErrorMessage((err.stack || '').replace(/\n/gu, ' '));
}

/**
 * @param {TextDocument} document
 * @returns {Promise<void>}
 */
async function validate(document) {
	if (!isValidateOn(document)) {
		return;
	}

	const options = await buildStylelintOptions(document);

	try {
		const result = await stylelintVSCode(
			document,
			options,
			await buildStylelintVSCodeOptions(document),
		);

		connection.sendDiagnostics({
			uri: document.uri,
			diagnostics: result.diagnostics,
		});
		documentDiagnostics.set(document.uri, result.diagnostics);

		if (result.needlessDisables) {
			needlessDisableReports.set(document.uri, result.needlessDisables);
		}

		if (result.invalidScopeDisables) {
			invalidScopeDisableReports.set(document.uri, result.invalidScopeDisables);
		}
	} catch (err) {
		handleError(err);
	}
}

/**
 * @param {TextDocument} document
 * @param {import('vscode-languageserver').FormattingOptions?} formattingOptions Formatting options to use.
 * Overriden by stylelint configuration.
 * @returns {Promise<TextEdit[]>}
 */
async function getFixes(document, formattingOptions = null) {
	/** @type {Partial<import('stylelint').StylelintStandaloneOptions>} */
	const baseOptions = { fix: true };

	// If formatting options were provided, translate them to their corresponding rules.
	// NOTE: There is no equivalent rule for trimFinalNewlines, so it is not respected.
	if (formattingOptions) {
		const { insertSpaces, tabSize, insertFinalNewline, trimTrailingWhitespace } = formattingOptions;

		/** @type {Record<string, any>} */
		const rules = {
			indentation: [insertSpaces ? tabSize : 'tab'],
		};

		if (insertFinalNewline !== undefined) {
			rules['no-missing-end-of-source-newline'] = insertFinalNewline;
		}

		if (trimTrailingWhitespace !== undefined) {
			rules['no-eol-whitespace'] = trimTrailingWhitespace;
		}

		baseOptions.config = { rules };
	}

	const options = await buildStylelintOptions(document, baseOptions);

	try {
		const result = await stylelintVSCode(
			document,
			options,
			await buildStylelintVSCodeOptions(document),
		);

		if (typeof result.output !== 'string') {
			return [];
		}

		const code = document.getText();
		const fixedCode = result.output;

		if (fixedCode === code) {
			return [];
		}

		return replaceEdits(document, fixedCode);
	} catch (err) {
		handleError(err);

		return [];
	}
}

/**
 * @returns {void}
 */
function validateAll() {
	for (const document of documents.all()) {
		validate(document);
	}
}

/**
 * @param {TextDocument} document
 * @returns {void}
 */
function clearDiagnostics(document) {
	connection.sendDiagnostics({
		uri: document.uri,
		diagnostics: [],
	});
	documentDiagnostics.delete(document.uri);
	needlessDisableReports.delete(document.uri);
	invalidScopeDisableReports.delete(document.uri);
}

/**
 * @param {TextDocument} document
 * @returns {boolean}
 */
function isValidateOn(document) {
	return validateLanguages.includes(document.languageId);
}

/** Whether or not dynamic registration for document formatting should be attempted. */
let registerFormatterDynamically = false;

/**
 * A promise that resolves to the disposable for the dynamically registered document formatter.
 * @type {Promise<import('vscode').Disposable> | undefined}
 */
let formatterRegistration;

connection.onInitialize(({ capabilities }) => {
	validateAll();

	registerFormatterDynamically = Boolean(
		capabilities.textDocument?.formatting?.dynamicRegistration,
	);

	return {
		capabilities: {
			textDocumentSync: {
				openClose: true,
				change: TextDocumentSyncKind.Full,
			},
			executeCommandProvider: {
				commands: [CommandIds.applyAutoFix],
			},
			// Use static registration if dynamic registration is not supported by the client
			documentFormattingProvider: !registerFormatterDynamically,
			codeActionProvider: { codeActionKinds: [CodeActionKind.QuickFix, StylelintSourceFixAll] },
			completionProvider: {},
		},
	};
});
connection.onDidChangeConfiguration(({ settings }) => {
	/** @type {string[]} */
	const oldValidateLanguages = validateLanguages || [];

	config = settings.stylelint.config;
	configOverrides = settings.stylelint.configOverrides;
	configFile = settings.stylelint.configFile;
	configBasedir = settings.stylelint.configBasedir;
	syntax = settings.stylelint.syntax || undefined;
	customSyntax = settings.stylelint.customSyntax;
	ignoreDisables = settings.stylelint.ignoreDisables;
	reportNeedlessDisables = settings.stylelint.reportNeedlessDisables;
	reportInvalidScopeDisables = settings.stylelint.reportInvalidScopeDisables;
	stylelintPath = settings.stylelint.stylelintPath;
	packageManager = settings.stylelint.packageManager || 'npm';
	validateLanguages = settings.stylelint.validate || [];
	snippetLanguages = settings.stylelint.snippet || ['css', 'less', 'postcss', 'scss'];

	const validateLanguageSet = new Set(validateLanguages);
	const oldValidateLanguageSet = new Set(oldValidateLanguages);

	/** Whether or not the list of languages that should be validated has changed. */
	let changed = validateLanguageSet.size !== oldValidateLanguageSet.size;

	/** The languages removed from the list of languages that should be validated */
	const removeLanguages = new Set();

	// Check if the sets are unequal, which means that the list of languages that should be
	// validated has changed.
	for (const language of oldValidateLanguageSet) {
		if (!validateLanguageSet.has(language)) {
			removeLanguages.add(language);
			changed = true;
		}
	}

	// If languages have been removed, clear diagnostics for documents of those languages.
	if (removeLanguages.size > 0) {
		for (const document of documents.all().filter((doc) => removeLanguages.has(doc.languageId))) {
			clearDiagnostics(document);
		}
	}

	// If dynamic registration is supported and the list of languages that should be validated
	// has changed, then (re-)register the formatter.
	if (registerFormatterDynamically && changed) {
		// Dispose the old formatter registration if it exists.
		if (formatterRegistration) {
			void formatterRegistration.then((disposable) => disposable.dispose());
		}

		// If there are languages that should be validated, register a formatter for those
		// languages.
		if (validateLanguages.length > 0) {
			formatterRegistration = connection.client.register(DocumentFormattingRequest.type, {
				documentSelector: validateLanguages,
			});
		}
	}

	validateAll();
});
connection.onDidChangeWatchedFiles(validateAll);

documents.onDidChangeContent(({ document }) => validate(document));
documents.onDidClose(({ document }) => {
	clearDiagnostics(document);
});
connection.onExecuteCommand(async (params) => {
	if (params.command === CommandIds.applyAutoFix) {
		if (!params.arguments) {
			return {};
		}

		/** @type { { version: number, uri: string } } */
		const identifier = params.arguments[0];
		const uri = identifier.uri;
		const document = documents.get(uri);

		if (!document || !isValidateOn(document)) {
			return {};
		}

		if (identifier.version !== document.version) {
			return {};
		}

		const workspaceChange = new WorkspaceChange();
		const textChange = workspaceChange.getTextEditChange(identifier);

		const edits = await getFixes(document);

		edits.forEach((edit) => textChange.add(edit));

		return connection.workspace.applyEdit(workspaceChange.edit).then(
			(response) => {
				if (!response.applied) {
					connection.console.error(`Failed to apply command: ${params.command}`);
				}

				return {};
			},
			() => {
				connection.console.error(`Failed to apply command: ${params.command}`);
			},
		);
	}

	return {};
});
connection.onDocumentFormatting((params) => {
	if (!params.textDocument) {
		return null;
	}

	/** @type { { uri: string } } */
	const identifier = params.textDocument;
	const uri = identifier.uri;
	const document = documents.get(uri);

	if (!document || !isValidateOn(document)) {
		return null;
	}

	return getFixes(document, params.options);
});
connection.onCodeAction(async (params) => {
	const only = params.context.only !== undefined ? params.context.only[0] : undefined;
	const isSource = only === CodeActionKind.Source;
	const isSourceFixAll = only === StylelintSourceFixAll || only === CodeActionKind.SourceFixAll;

	if (isSourceFixAll || isSource) {
		const uri = params.textDocument.uri;
		const textDocument = documents.get(uri);

		if (!textDocument || !isValidateOn(textDocument)) {
			return [];
		}

		const textDocumentIdentifer = { uri: textDocument.uri, version: textDocument.version };
		const edits = await getFixes(textDocument);

		return [
			CodeAction.create(
				`Fix all stylelint auto-fixable problems`,
				{ documentChanges: [TextDocumentEdit.create(textDocumentIdentifer, edits)] },
				StylelintSourceFixAll,
			),
		];
	}

	if (only === CodeActionKind.QuickFix) {
		const uri = params.textDocument.uri;
		const textDocument = documents.get(uri);

		if (!textDocument || !isValidateOn(textDocument)) {
			return [];
		}

		if (!textDocument) {
			return [];
		}

		const textDocumentIdentifer = { uri: textDocument.uri, version: textDocument.version };

		const diagnostics = params.context.diagnostics;
		const needlessDisables = needlessDisableReports.get(uri) || invalidScopeDisableReports.get(uri);

		if (!needlessDisables) {
			return [];
		}

		/**
		 * @type {CodeAction[]}
		 */
		const results = [];

		for (const diagnostic of diagnostics) {
			const diagnosticKey = computeKey(diagnostic);

			for (const needlessDisable of needlessDisables) {
				if (computeKey(needlessDisable.diagnostic) === diagnosticKey) {
					const edits = createRemoveCommentDirectiveTextEdits(textDocument, needlessDisable.range);

					if (edits.length > 0) {
						results.push(
							CodeAction.create(
								needlessDisable.range.unusedRule !== 'all'
									? `Remove unused stylelint comment directive for ${needlessDisable.range.unusedRule} rule`
									: `Remove unused stylelint comment directive.`,
								{ documentChanges: [TextDocumentEdit.create(textDocumentIdentifer, edits)] },
								CodeActionKind.QuickFix,
							),
						);
					}

					break;
				}
			}
		}

		return results;
	}
});

connection.onCompletion(onCompletion);

documents.listen(connection);

connection.listen();

/**
 * @param {TextDocument} document
 * @returns {Promise<string | undefined>}
 */
async function getWorkspaceFolder(document) {
	const documentPath = parseUri(document.uri).fsPath;
	const workspaceFolders = await connection.workspace.getWorkspaceFolders();

	if (documentPath) {
		if (workspaceFolders) {
			for (const { uri } of workspaceFolders) {
				const workspacePath = parseUri(uri).fsPath;

				if (pathIsInside(documentPath, workspacePath)) {
					return workspacePath;
				}
			}
		}
	} else if (workspaceFolders && workspaceFolders.length) {
		const { uri } = workspaceFolders[0];

		return parseUri(uri).fsPath;
	}

	return undefined;
}

/**
 * If replace all of the document, the cursor will move to the last position.
 * Apply diff only edits to keep the cursor position.
 * @param {TextDocument} document
 * @param {string} newText
 * @returns {TextEdit[]}
 */
function replaceEdits(document, newText) {
	const results = diff(document.getText(), newText);

	const edits = [];
	let offset = 0;

	for (const result of results) {
		const start = offset;
		const op = result[0];
		const text = result[1];

		switch (op) {
			case diff.INSERT:
				edits.push(TextEdit.insert(document.positionAt(start), text));
				break;
			case diff.DELETE:
				offset += text.length;
				edits.push(
					TextEdit.del(Range.create(document.positionAt(start), document.positionAt(offset))),
				);
				break;
			case diff.EQUAL:
				offset += text.length;
				break;
		}
	}

	return edits;
}

/**
 * @param {CompletionParams} params
 * @returns {CompletionItem[]}
 */
function onCompletion(params) {
	const uri = params.textDocument.uri;
	const document = documents.get(uri);

	if (!document || !isValidateOn(document) || !snippetLanguages.includes(document.languageId)) {
		return [];
	}

	const diagnostics = documentDiagnostics.get(uri);

	if (!diagnostics) {
		return [
			createDisableLineCompletionItem('stylelint-disable-line'),
			createDisableLineCompletionItem('stylelint-disable-next-line'),
			createDisableEnableCompletionItem(),
		];
	}

	/** @type {Set<string>} */
	const needlessDisablesKeys = new Set();
	const needlessDisables = needlessDisableReports.get(uri);

	if (needlessDisables) {
		for (const needlessDisable of needlessDisables) {
			needlessDisablesKeys.add(computeKey(needlessDisable.diagnostic));
		}
	}

	const thisLineRules = new Set();
	const nextLineRules = new Set();

	for (const diagnostic of diagnostics) {
		if (needlessDisablesKeys.has(computeKey(diagnostic))) {
			continue;
		}

		const start = diagnostic.range.start;

		const rule = String(
			(DiagnosticCode.is(diagnostic.code) ? diagnostic.code.value : diagnostic.code) || '',
		);

		if (start.line === params.position.line) {
			thisLineRules.add(rule);
		} else if (start.line === params.position.line + 1) {
			nextLineRules.add(rule);
		}
	}

	thisLineRules.delete('');
	thisLineRules.delete('CssSyntaxError');
	nextLineRules.delete('');
	nextLineRules.delete('CssSyntaxError');

	/** @type {CompletionItem[]} */
	const results = [];

	const disableKind = getStyleLintDisableKind(document, params.position);

	if (disableKind) {
		if (disableKind === 'stylelint-disable-line') {
			for (const rule of thisLineRules) {
				results.push({
					label: rule,
					kind: CompletionItemKind.Snippet,
					detail: `disable ${rule} rule. (stylelint)`,
				});
			}
		} else if (
			disableKind === 'stylelint-disable' ||
			disableKind === 'stylelint-disable-next-line'
		) {
			for (const rule of nextLineRules) {
				results.push({
					label: rule,
					kind: CompletionItemKind.Snippet,
					detail: `disable ${rule} rule. (stylelint)`,
				});
			}
		}
	} else {
		if (thisLineRules.size === 1) {
			results.push(
				createDisableLineCompletionItem('stylelint-disable-line', [...thisLineRules][0]),
			);
		} else {
			results.push(createDisableLineCompletionItem('stylelint-disable-line'));
		}

		if (nextLineRules.size === 1) {
			results.push(
				createDisableLineCompletionItem('stylelint-disable-next-line', [...nextLineRules][0]),
			);
		} else {
			results.push(createDisableLineCompletionItem('stylelint-disable-next-line'));
		}

		results.push(createDisableEnableCompletionItem());
	}

	return results;
}

/**
 * @param { 'stylelint-disable-line' | 'stylelint-disable-next-line' } kind
 * @param {string} rule
 * @returns {CompletionItem}
 */
function createDisableLineCompletionItem(kind, rule = '') {
	return {
		label: kind,
		kind: CompletionItemKind.Snippet,
		insertText: `/* ${kind} \${0:${rule || 'rule'}} */`,
		insertTextFormat: InsertTextFormat.Snippet,
		detail:
			kind === 'stylelint-disable-line'
				? 'Turn off stylelint rules for individual lines only, after which you do not need to explicitly re-enable them. (stylelint)'
				: 'Turn off stylelint rules for the next line only, after which you do not need to explicitly re-enable them. (stylelint)',
		documentation: {
			kind: MarkupKind.Markdown,
			value: `\`\`\`css\n/* ${kind} ${rule || 'rule'} */\n\`\`\``,
		},
	};
}

/**
 * @returns {CompletionItem}
 */
function createDisableEnableCompletionItem() {
	return {
		label: 'stylelint-disable',
		kind: CompletionItemKind.Snippet,
		insertText: `/* stylelint-disable \${0:rule} */\n/* stylelint-enable \${0:rule} */`,
		insertTextFormat: InsertTextFormat.Snippet,
		detail:
			'Turn off all stylelint or individual rules, after which you do not need to re-enable stylelint. (stylelint)',
		documentation: {
			kind: MarkupKind.Markdown,
			value: `\`\`\`css\n/* stylelint-disable rule */\n/* stylelint-enable rule */\n\`\`\``,
		},
	};
}

/**
 * Check if the given position is in the stylelint-disable comment.
 * If inside a comment, return the kind of disable.
 * @param {TextDocument} document
 * @param {Position} position
 */
function getStyleLintDisableKind(document, position) {
	const lineStartOffset = document.offsetAt(Position.create(position.line, 0));
	const lineEndOffset = document.offsetAt(Position.create(position.line + 1, 0)) - 1;
	const line = document.getText().slice(lineStartOffset, lineEndOffset);

	const before = line.slice(0, position.character);
	const after = line.slice(position.character);

	const disableKindResult = /\/\*\s*(stylelint-disable(?:(?:-next)?-line)?)\s[a-z\-/\s,]*$/i.exec(
		before,
	);

	if (!disableKindResult) {
		return null;
	}

	if (/^[a-z\-/\s,]*\*\//i.test(after)) {
		return disableKindResult[1];
	}

	return null;
}

/**
 * @param {TextDocument} document
 * @param {DisableReportRange} range
 * @returns {TextEdit[]}
 */
function createRemoveCommentDirectiveTextEdits(document, range) {
	const text = document.getText();
	const startLine = range.start - 1;
	const startLineStartOffset = document.offsetAt(Position.create(startLine, 0));
	const startLineEndOffset = document.offsetAt(Position.create(startLine + 1, 0)) - 1;

	if (range.end !== undefined) {
		if (range.start === range.end) {
			// `/* stylelint-disable-line */`
			const stylelintDisableLineText = text.slice(startLineStartOffset, startLineEndOffset);
			const newStylelintDisableLineText = removeCommentDirective(
				range,
				stylelintDisableLineText,
				'stylelint-disable-line',
			);

			if (newStylelintDisableLineText !== stylelintDisableLineText) {
				return [
					TextEdit.replace(
						Range.create(
							document.positionAt(startLineStartOffset),
							document.positionAt(startLineEndOffset),
						),
						newStylelintDisableLineText,
					),
				];
			}

			// `/* stylelint-disable-next-line */`
			if (startLine > 0) {
				const prevLineStartOffset = document.offsetAt(Position.create(startLine - 1, 0));
				const prevLineEndOffset = document.offsetAt(Position.create(startLine, 0)) - 1;
				const stylelintDisableNextLineText = text.slice(prevLineStartOffset, prevLineEndOffset);
				const newStylelintDisableNextLineText = removeCommentDirective(
					range,
					stylelintDisableNextLineText,
					'stylelint-disable-next-line',
				);

				if (newStylelintDisableNextLineText !== stylelintDisableNextLineText) {
					return [
						TextEdit.replace(
							Range.create(
								document.positionAt(prevLineStartOffset),
								document.positionAt(prevLineEndOffset),
							),
							newStylelintDisableNextLineText,
						),
					];
				}
			}
		}
	}

	// `/* stylelint-disable */`
	const stylelintDisableText = text.slice(startLineStartOffset, startLineEndOffset);
	const newStylelintDisableText = removeCommentDirective(
		range,
		stylelintDisableText,
		'stylelint-disable',
	);

	if (newStylelintDisableText !== stylelintDisableText) {
		const stylelintDisableEdit = TextEdit.replace(
			Range.create(
				document.positionAt(startLineStartOffset),
				document.positionAt(startLineEndOffset),
			),
			newStylelintDisableText,
		);

		if (range.end === null || range.end === undefined) {
			return [stylelintDisableEdit];
		}

		const endLine = range.end - 1;
		const endLineStartOffset = document.offsetAt(Position.create(endLine, 0));
		const endLineEndOffset = document.offsetAt(Position.create(endLine + 1, 0)) - 1;
		const stylelintEnableText = text.slice(endLineStartOffset, endLineEndOffset);
		const newStylelintEnableText = removeCommentDirective(
			range,
			stylelintEnableText,
			'stylelint-enable',
		);

		if (newStylelintEnableText !== stylelintEnableText) {
			return [
				stylelintDisableEdit,
				TextEdit.replace(
					Range.create(
						document.positionAt(endLineStartOffset),
						document.positionAt(endLineEndOffset),
					),
					newStylelintEnableText,
				),
			];
		}
	}

	return [];
}

/**
 * @param {Diagnostic} diagnostic
 * @returns {string}
 */
function computeKey(diagnostic) {
	const range = diagnostic.range;

	return `[${range.start.line},${range.start.character},${range.end.line},${range.end.character}]-${diagnostic.code}`;
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'); // $& means the whole matched string
}

/**
 * @param {DisableReportRange} range
 * @param {string} text
 * @param {string} directive
 * @returns {string}
 */
function removeCommentDirective(range, text, directive) {
	if (range.unusedRule !== 'all') {
		// `/* directive rulename */`
		let newText = text.replace(
			new RegExp(`\\/\\*\\s*${directive}\\s+${escapeRegExp(range.unusedRule)}\\s*\\*\\/`),
			removesReplacer,
		);

		if (newText !== text) {
			return newText;
		}

		// `/* directive xxx, rulename */`
		newText = text.replace(
			new RegExp(
				`(\\/\\*\\s*${directive}\\s+[\\s\\S]*)\\s*,\\s*${escapeRegExp(
					range.unusedRule,
				)}([\\s\\S]*\\*\\/)`,
			),
			removesReplacer,
		);

		if (newText !== text) {
			return newText;
		}

		// `/* directive rulename, xxx */`
		newText = text.replace(
			new RegExp(
				`(\\/\\*\\s*${directive}\\s+[\\s\\S]*)${escapeRegExp(
					range.unusedRule,
				)}\\s*,\\s*([\\s\\S]*\\*\\/)`,
			),
			removesReplacer,
		);

		return newText;
	}

	// `/* directive */`
	return text.replace(new RegExp(`\\/\\*\\s*${directive}\\s*\\*\\`), removesReplacer);

	/**
	 * @param  {string[]} args
	 */
	function removesReplacer(...args) {
		let newText = '';

		for (let index = 1; index < args.length - 2; index++) {
			newText += args[index];
		}

		return newText;
	}
}
