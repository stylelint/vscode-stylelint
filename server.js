'use strict';

const langServer = require('vscode-languageserver');
const Files = langServer.Files;
const stylelintVSCode = require('stylelint-vscode');

let configBasedir;
let config;
let configOverrides;

const connection = langServer.createConnection(process.stdin, process.stdout);
const documents = new langServer.TextDocuments();

const supportedCustomSyntaxes = new Set(['less', 'scss']);

function validate(document) {
  return stylelintVSCode({
    code: document.getText(),
    codeFilename: Files.uriToFilePath(document.uri),
    config,
    configOverrides,
    configBasedir,
    syntax: supportedCustomSyntaxes.has(document.languageId) ? document.languageId : null
  }).then(diagnostics => {
    connection.sendDiagnostics({uri: document.uri, diagnostics});
  }).catch(err => {
    if (err.reasons) {
      err.reasons.forEach(reason => connection.window.showErrorMessage('stylelint: ' + reason));
      return;
    }

    // https://github.com/stylelint/stylelint/blob/4.2.0/src/utils/configurationError.js#L3
    if (err.code === 78) {
      connection.window.showErrorMessage('stylelint: ' + err.message);
      return;
    }

    connection.window.showErrorMessage(err.stack.replace(/\n/g, ' '));
  });
}

function validateAll() {
  return Promise.all(documents.all().map(document => validate(document)));
}

connection.onInitialize(params => {
  if (params.rootPath) {
    configBasedir = params.rootPath;
  }

  validateAll();

  return {
    capabilities: {
      textDocumentSync: documents.syncKind
    }
  };
});
connection.onDidChangeConfiguration(params => {
  const settings = params.settings;
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
