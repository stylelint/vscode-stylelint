'use strict';

const { join, parse, isAbsolute } = require('path');

const diff = require('fast-diff');
const findPkgDir = require('./lib/find-pkg-dir');
const parseUri = require('vscode-uri').URI.parse;
const pathIsInside = require('path-is-inside');
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
} = require('vscode-languageserver');
const { TextDocument } = require('vscode-languageserver-textdocument');

const CommandIds = {
	applyAutoFix: 'stylelint.applyAutoFix',
};

const StylelintSourceFixAll = `${CodeActionKind.SourceFixAll}.stylelint`;

let config;
let configOverrides;
let packageManager;
let customSyntax;
let reportNeedlessDisables;
let stylelintPath;

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

/**
 * @typedef { import('vscode-languageserver').DocumentUri } DocumentUri
 * @typedef { import('vscode-languageserver').Diagnostic } Diagnostic
 * @typedef { import('./lib/stylelint-vscode').DisableReportRange } DisableReportRange
 */

/**
 * @type {Map<DocumentUri, ({ diagnostic: Diagnostic, range: DisableReportRange })[]>}
 */
const needlessDisableReports = new Map();

/**
 *
 * @param {TextDocument} document
 * @param {*} baseOptions
 */
async function buildStylelintOptions(document, baseOptions = {}) {
	const options = { ...baseOptions };

	if (config) {
		options.config = config;
	}

	if (configOverrides) {
		options.configOverrides = configOverrides;
	}

	if (reportNeedlessDisables) {
		options.reportNeedlessDisables = reportNeedlessDisables;
	}

	const workspaceFolder = await getWorkspaceFolder(document);
	const documentPath = parseUri(document.uri).fsPath;

	if (customSyntax) {
		options.customSyntax = workspaceFolder
			? customSyntax.replace(/\$\{workspaceFolder\}/gu, workspaceFolder)
			: customSyntax;
	}

	if (documentPath) {
		if (workspaceFolder && pathIsInside(documentPath, workspaceFolder)) {
			options.ignorePath = join(workspaceFolder, '.stylelintignore');
		}

		if (options.ignorePath === undefined) {
			options.ignorePath = join(
				findPkgDir(documentPath) || parse(documentPath).root,
				'.stylelintignore',
			);
		}
	}

	return options;
}

async function buildStylelintVSCodeOptions(document) {
	const options = { connection, packageManager };

	if (stylelintPath) {
		if (isAbsolute(stylelintPath)) {
			options.stylelintPath = stylelintPath;
		} else {
			const workspaceFolder = await getWorkspaceFolder(document);

			options.stylelintPath = join(workspaceFolder, stylelintPath);
		}
	}

	return options;
}

function handleError(err) {
	if (err.reasons) {
		for (const reason of err.reasons) {
			connection.window.showErrorMessage(`stylelint: ${reason}`);
		}

		return;
	}

	// https://github.com/stylelint/stylelint/blob/10.0.1/lib/utils/configurationError.js#L10
	if (err.code === 78) {
		connection.window.showErrorMessage(`stylelint: ${err.message}`);

		return;
	}

	connection.window.showErrorMessage(err.stack.replace(/\n/gu, ' '));
}

/**
 * @param {TextDocument} document
 */
async function validate(document) {
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

		needlessDisableReports.set(document.uri, result.needlessDisables);
	} catch (err) {
		handleError(err);
	}
}

/**
 * @param {TextDocument} document
 * @returns {Promise<TextEdit[]>}
 */
async function getFixes(document) {
	const options = await buildStylelintOptions(document, { fix: true });

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

function validateAll() {
	for (const document of documents.all()) {
		validate(document);
	}
}

connection.onInitialize(() => {
	validateAll();

	return {
		capabilities: {
			textDocumentSync: {
				openClose: true,
				change: TextDocumentSyncKind.Full,
			},
			executeCommandProvider: {
				commands: [CommandIds.applyAutoFix],
			},
			codeActionProvider: { codeActionKinds: [CodeActionKind.QuickFix, StylelintSourceFixAll] },
		},
	};
});
connection.onDidChangeConfiguration(({ settings }) => {
	config = settings.stylelint.config;
	configOverrides = settings.stylelint.configOverrides;
	customSyntax = settings.stylelint.customSyntax;
	reportNeedlessDisables = settings.stylelint.reportNeedlessDisables;
	stylelintPath = settings.stylelint.stylelintPath;
	packageManager = settings.stylelint.packageManager || 'npm';

	validateAll();
});
connection.onDidChangeWatchedFiles(validateAll);

documents.onDidChangeContent(({ document }) => validate(document));
documents.onDidClose(({ document }) => {
	connection.sendDiagnostics({
		uri: document.uri,
		diagnostics: [],
	});
	needlessDisableReports.delete(document.uri);
});
connection.onExecuteCommand(async (params) => {
	if (params.command === CommandIds.applyAutoFix) {
		const identifier = params.arguments[0];
		const uri = identifier.uri;
		const document = documents.get(uri);

		if (!document || identifier.version !== document.version) {
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
connection.onCodeAction(async (params) => {
	const only = params.context.only !== undefined ? params.context.only[0] : undefined;
	const isSource = only === CodeActionKind.Source;
	const isSourceFixAll = only === StylelintSourceFixAll || only === CodeActionKind.SourceFixAll;

	if (isSourceFixAll || isSource) {
		const uri = params.textDocument.uri;
		const textDocument = documents.get(uri);
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
		const textDocumentIdentifer = { uri: textDocument.uri, version: textDocument.version };

		if (!textDocument) {
			return [];
		}

		const diagnostics = params.context.diagnostics;
		const needlessDisables = needlessDisableReports.get(uri);

		if (!needlessDisables) {
			return [];
		}

		/**
		 * @type {CodeAction[]}
		 */
		const results = [];

		for (const diagnostic of diagnostics) {
			const diagnostickey = computeKey(diagnostic);

			for (const needlessDisable of needlessDisables) {
				if (computeKey(needlessDisable.diagnostic) === diagnostickey) {
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

documents.listen(connection);

connection.listen();

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
	} else if (workspaceFolders.length) {
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
	const text = document.getText();

	const results = diff(text, newText);

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

		if (range.end === undefined) {
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

	return null;
}

/**
 * @param {Diagnostic} diagnostic
 * @returns {string}
 */
function computeKey(diagnostic) {
	const range = diagnostic.range;

	return `[${range.start.line},${range.start.character},${range.end.line},${range.end.character}]-${diagnostic.code}`;
}

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'); // $& means the whole matched string
}

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

	function removesReplacer(...args) {
		let newText = '';

		for (let index = 1; index < args.length - 2; index++) {
			newText += args[index];
		}

		return newText;
	}
}
