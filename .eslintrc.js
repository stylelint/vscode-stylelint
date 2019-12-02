module.exports = {
	parserOptions: {
		ecmaVersion: 2019,
	},
	extends: ['stylelint', 'prettier'],
	rules: {
		'node/no-missing-require': [
			'error',
			{
				allowModules: ['vscode'],
			},
		],
		'node/no-unpublished-require': [
			'error',
			{
				allowModules: ['vscode', 'p-wait-for', 'tape'],
			},
		],
	},
};
