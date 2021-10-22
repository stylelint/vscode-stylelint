'use strict';

module.exports = {
	...require('./find-package-root'),
	...require('./global-path-resolver'),
	...require('./stylelint-resolver'),
};
