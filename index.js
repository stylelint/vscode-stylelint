'use strict';

const {join} = require('path');

const {LanguageClient, SettingMonitor} = require('vscode-languageclient');
const {workspace} = require('vscode');

exports.activate = ({subscriptions}) => {
	const serverPath = join(__dirname, 'server.js');
	const workspaceConfig = workspace.getConfiguration('stylelint');
	const additionalDocuments = workspaceConfig.get('additionalDocumentSelectors');

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
		documentSelector: ['css', 'less', 'postcss', 'scss', 'sugarss', ...additionalDocuments],
		synchronize: {
			configurationSection: 'stylelint',
			fileEvents: workspace.createFileSystemWatcher('**/{.stylelintrc,stylelint.config.js}')
		}
	});

	subscriptions.push(new SettingMonitor(client, 'stylelint.enable').start());
};
