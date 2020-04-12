module.exports = {
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
				allowModules: [
					'vscode',
					'p-wait-for',
					'tape',
					'rmfr',
					'eslint',
					'lodash',
					'find-pkg',
					'find-root',
					'pkg-dir',
					'stylelint',
				],
			},
		],
	},
};
