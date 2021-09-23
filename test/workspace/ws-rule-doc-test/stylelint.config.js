'use strict';

module.exports = {
	plugins: [require.resolve('./test-plugin')],
	rules: {
		indentation: [4],
		'color-no-invalid-hex': true,
		'plugin/foo-bar': true,
	},
};
