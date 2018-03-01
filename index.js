'use strict';

const {join} = require('path');

const {LanguageClient, SettingMonitor} = require('vscode-languageclient');
const {workspace} = require('vscode');
const {activationEvents} = require('./package.json');

const defaultDocuments = [];

for (const activationEvent of activationEvents) {
	if (activationEvent.startsWith('onLanguage:')) {
		defaultDocuments.push(activationEvent.replace('onLanguage:', ''));
	}
}

exports.activate = ({subscriptions}) => {
	const serverPath = join(__dirname, 'server.js');
	const workspaceConfig = workspace.getConfiguration('stylelint');

	const client = new LanguageClient('stylelint', {
		run: {
			module: serverPath
		},
		debug: {
			module: serverPath,
			options: {
				execArgv: ['--nolazy', '--debug=6004']
			}
		}
	}, {
		documentSelector: [...defaultDocuments, ...workspaceConfig.get('additionalDocumentSelectors')],
		synchronize: {
			configurationSection: 'stylelint',
			fileEvents: workspace.createFileSystemWatcher('**/{.stylelintrc{,.js,.json,.yaml,.yml},stylelint.config.js}')
		}
	});

	subscriptions.push(new SettingMonitor(client, 'stylelint.enable').start());
};
