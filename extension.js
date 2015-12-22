'use strict';

const path = require('path');

const langClient = require('vscode-languageclient');
const LanguageClient = langClient.LanguageClient;
const SettingMonitor = langClient.SettingMonitor;
const vscode = require('vscode');

exports.activate = function activateStylelint(context) {
  const serverModule = path.join(__dirname, 'server.js');

  const client = new LanguageClient('stylelint', {
    run: {
      module: serverModule
    },
    debug: {
      module: serverModule,
      options: {
        execArgv: ['--nolazy', '--debug=6004']
      }
    }
  }, {
    documentSelector: ['css', 'sass'],
    synchronize: {
      configurationSection: 'stylelint',
      fileEvents: vscode.workspace.createFileSystemWatcher('**/{.stylelintrc,stylelint.config.js}')
    }
  });

  context.subscriptions.push(new SettingMonitor(client, 'stylelint.enable').start());
};
