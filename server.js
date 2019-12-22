'use strict';

const { join, parse } = require('path');

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

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

async function buildStylelintOptions(document, baseOptions = {}) {
	const options = { ...baseOptions };

	if (config) {
		options.config = config;
	}

	if (configOverrides) {
		options.configOverrides = configOverrides;
	}

	const documentPath = parseUri(document.uri).fsPath;

	if (documentPath) {
		const workspaceFolders = await connection.workspace.getWorkspaceFolders();

		if (workspaceFolders) {
			for (const { uri } of workspaceFolders) {
				const workspacePath = parseUri(uri).fsPath;

				if (pathIsInside(documentPath, workspacePath)) {
					options.ignorePath = join(workspacePath, '.stylelintignore');
					break;
				}
			}
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

async function validate(document) {
	const options = await buildStylelintOptions(document);

	try {
		const result = await stylelintVSCode(document, options);

		connection.sendDiagnostics({
			uri: document.uri,
			diagnostics: result.diagnostics,
		});
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
		const result = await stylelintVSCode(document, options);

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
			codeActionProvider: { codeActionKinds: [StylelintSourceFixAll] },
		},
	};
});
connection.onDidChangeConfiguration(({ settings }) => {
	config = settings.stylelint.config;
	configOverrides = settings.stylelint.configOverrides;

	validateAll();
});
connection.onDidChangeWatchedFiles(validateAll);

documents.onDidChangeContent(({ document }) => validate(document));
documents.onDidClose(({ document }) =>
	connection.sendDiagnostics({
		uri: document.uri,
		diagnostics: [],
	}),
);
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
});

documents.listen(connection);

connection.listen();

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
