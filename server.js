'use strict';

const {createConnection, Files, TextDocuments} = require('vscode-languageserver');
const stylelintVSCode = require('stylelint-vscode');

let config;
let configOverrides;

const connection = createConnection(process.stdin, process.stdout);
const documents = new TextDocuments();

const supportedCustomSyntaxes = new Set(['less', 'scss']);

function validate(document) {
	const options = {code: document.getText()};

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

	if (supportedCustomSyntaxes.has(document.languageId)) {
		options.syntax = document.languageId;
	}

	return stylelintVSCode(options).then(diagnostics => {
		connection.sendDiagnostics({uri: document.uri, diagnostics});
	}).catch(err => {
		if (err.reasons) {
			err.reasons.forEach(reason => connection.window.showErrorMessage(`stylelint: ${reason}`));
			return;
		}

		// https://github.com/stylelint/stylelint/blob/8.4.0/lib/utils/configurationError.js#L9
		if (err.code === 78) {
			connection.window.showErrorMessage(`stylelint: ${err.message}`);
			return;
		}

		connection.window.showErrorMessage(err.stack.replace(/\n/g, ' '));
	});
}

function validateAll() {
	return Promise.all(documents.all().map(document => validate(document)));
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
connection.onDidChangeWatchedFiles(() => validateAll());

documents.onDidChangeContent(event => validate(event.document));
documents.onDidClose(event => connection.sendDiagnostics({
	uri: event.document.uri,
	diagnostics: []
}));
documents.listen(connection);

connection.listen();
