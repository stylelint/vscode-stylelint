'use strict';

const {createConnection, TextDocuments} = require('vscode-languageserver');
const stylelintVSCode = require('stylelint-vscode');

let config;
let configOverrides;

const connection = createConnection(process.stdin, process.stdout);
const documents = new TextDocuments();

async function validate(document) {
	const options = {};

	if (config) {
		options.config = config;
	}

	if (configOverrides) {
		options.configOverrides = configOverrides;
	}

	try {
		connection.sendDiagnostics({
			uri: document.uri,
			diagnostics: await stylelintVSCode(document, options)
		});
	} catch (err) {
		if (err.reasons) {
			for (const reason of err.reasons) {
				connection.window.showErrorMessage(`stylelint: ${reason}`);
			}

			return;
		}

		// https://github.com/stylelint/stylelint/blob/9.3.0/lib/utils/configurationError.js#L9
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
connection.onDidChangeConfiguration(({settings}) => {
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
