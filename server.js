'use strict';

const {createConnection, Files, TextDocuments} = require('vscode-languageserver');
const stylelintVSCode = require('stylelint-vscode');

let config;
let configOverrides;

const connection = createConnection(process.stdin, process.stdout);
const documents = new TextDocuments();

// https://github.com/stylelint/stylelint/blob/9.1.1/lib/getPostcssResult.js#L20-L24
const SUPPORTED_SYNTAXES = new Set([
	'less',
	'sass',
	'sugarss',
	'scss'
]);

async function validate(document) {
	const options = {
		code: document.getText(),
		languageId: document.languageId
	};

	const filePath = Files.uriToFilePath(document.uri);

	if (filePath) {
		options.codeFilename = filePath;
	}

	if (config) {
		options.config = config;
	}

	if (configOverrides) {
		options.configOverrides = configOverrides;
	}

	if (SUPPORTED_SYNTAXES.has(document.languageId)) {
		options.syntax = document.languageId;
	}

	try {
		connection.sendDiagnostics({
			uri: document.uri,
			diagnostics: await stylelintVSCode(options)
		});
	} catch (err) {
		if (err.reasons) {
			for (const reason of err.reasons) {
				connection.window.showErrorMessage(`stylelint: ${reason}`);
			}

			return;
		}

		// https://github.com/stylelint/stylelint/blob/9.1.1/lib/utils/configurationError.js#L9
		if (err.code === 78) {
			connection.window.showErrorMessage(`stylelint: ${err.message}`);
			return;
		}

		connection.window.showErrorMessage(err.stack.replace(/\n/g, ' '));
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
			textDocumentSync: documents.syncKind
		}
	};
});
connection.onDidChangeConfiguration(params => {
	const {settings} = params;
	config = settings.stylelint.config;
	configOverrides = settings.stylelint.configOverrides;

	validateAll();
});
connection.onDidChangeWatchedFiles(validateAll);

documents.onDidChangeContent(({document}) => validate(document));
documents.onDidClose(({document}) => connection.sendDiagnostics({
	uri: document.uri,
	diagnostics: []
}));
documents.listen(connection);

connection.listen();
