'use strict';

/** @type {import('eslint').Linter.Config} */
const config = {
	rules: {
		'node/no-unpublished-require': ['error', { allowModules: ['p-wait-for'] }],
	},
};

module.exports = config;
