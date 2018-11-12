'use strict';

const {LanguageClient, SettingMonitor} = require('vscode-languageclient');
const {workspace} = require('vscode');
const {activationEvents} = require('./package.json');

const documentSelector = [];

for (const activationEvent of activationEvents) {
	if (activationEvent.startsWith('onLanguage:')) {
		const language = activationEvent.replace('onLanguage:', '');
		documentSelector.push({language, scheme: 'file'}, {language, scheme: 'untitled'});
	}
}

exports.activate = ({subscriptions}) => {
	const serverPath = require.resolve('./server.js');

	const client = new LanguageClient('stylelint', {
		run: {
			module: serverPath
		},
		debug: {
			module: serverPath,
			options: {
				execArgv: ['--nolazy', '--inspect=6004']
			}
		}
	}, {
		documentSelector,
		diagnosticCollectionName: 'stylelint',
		synchronize: {
			configurationSection: 'stylelint',
			fileEvents: workspace.createFileSystemWatcher('**/{.stylelintrc{,.js,.json,.yaml,.yml},stylelint.config.js,.stylelintignore}')
		}
	});

	subscriptions.push(new SettingMonitor(client, 'stylelint.enable').start());
};
