'use strict';

/** @type {import('stylelint').Config} */
const config = {
	rules: {
		'color-hex-length': [
			'long',
			{ url: 'https://example.com/custom-color-hex-docs' },
		],
	},
};

module.exports = config;
