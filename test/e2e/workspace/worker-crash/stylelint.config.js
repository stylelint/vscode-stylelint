'use strict';

const path = require('node:path');

const crashPluginPath = path.join(__dirname, '../../..', 'shared', 'stylelint-crash-plugin.js');

/** @type {import('stylelint').Config} */
module.exports = {
	plugins: [crashPluginPath],
	rules: {},
	overrides: [
		{
			files: ['*.css'],
			rules: {
				'stylelint-crash/force-worker-crash': [
					true,
					{
						maxCrashes: 3,
						stateFile: path.join(__dirname, '.stylelint-worker-crash-state.json'),
					},
				],
			},
		},
	],
};
