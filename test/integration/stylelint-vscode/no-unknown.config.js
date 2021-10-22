'use strict';

const baseConfig = require('./stylelint.config');

module.exports = {
	...baseConfig,
	rules: {
		...baseConfig.rules,
		'property-no-unknown': [true, { ignoreProperties: 'what' }],
	},
};
