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
					'p-wait-for',
					'tape',
				],
			},
		],
		'jest/expect-expect': "off",
		'jest/no-test-callback': "off"
	},
};
