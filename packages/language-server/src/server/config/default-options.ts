// @no-unit-test -- This is just an export of an object, no logic to test.

import { LanguageServerOptions } from '../types.js';

export const defaultLanguageServerOptions: LanguageServerOptions = {
	codeAction: {
		disableRuleComment: {
			location: 'separateLine',
		},
	},
	config: null,
	configFile: '',
	configBasedir: '',
	customSyntax: '',
	ignoreDisables: false,
	ignorePath: '',
	packageManager: 'npm',
	reportDescriptionlessDisables: false,
	reportInvalidScopeDisables: false,
	reportNeedlessDisables: false,
	run: 'onType',
	rules: {
		customizations: [],
	},
	snippet: ['css', 'postcss'],
	stylelintPath: '',
	validate: ['css', 'postcss'],
	lintFiles: {
		glob: '**/*.css',
	},
};
