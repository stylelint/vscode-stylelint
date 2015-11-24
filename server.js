'use strict';

const path = require('path');

const langServer = require('vscode-languageserver');
const stylelintVSCode = require('stylelint-vscode');

let configBasedir;
let config;
let configOverrides;

const connection = langServer.createConnection(process.stdin, process.stdout);
const documents = new langServer.TextDocuments();

function validate(document) {
  return stylelintVSCode({
    code: document.getText(),
    config,
    configOverrides,
    configBasedir,
    syntax: path.extname(String(document.uri)).toLowerCase() === '.scss' ? 'scss' : null
  }).then(diagnostics => {
    connection.sendDiagnostics({uri: document.uri, diagnostics});
  }).catch(err => {
    if (err.reasons) {
      err.reasons.forEach(reason => connection.window.showErrorMessage('stylelint: ' + reason));
      return;
    }

    connection.window.showErrorMessage('stylelint: ' + err.message);
  });
}

function validateAll() {
  return Promise.all(documents.all().map(document => validate(document)));
}

connection.onInitialize(params => {
  configBasedir = params.rootPath;

  validateAll();

  return {
    capabilities: {
      textDocumentSync: documents.syncKind
    }
  };
});
connection.onDidChangeConfiguration(params => {
  const settings = params.settings;
  config = settings.stylelint.config || {};
  configOverrides = settings.stylelint.configOverrides || {};

  validateAll();
});
connection.onDidChangeWatchedFiles(() => validateAll());

documents.onDidChangeContent(event => validate(event.document));
documents.listen(connection);

connection.listen();
