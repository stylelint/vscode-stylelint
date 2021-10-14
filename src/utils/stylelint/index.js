'use strict';

module.exports = {
	...require('./process-linter-result'),
	...require('./stylelint-runner'),
	...require('./warning-to-diagnostic'),
};
