'use strict';

module.exports = {
	...require('./auto-fix'),
	...require('./code-action'),
	...require('./completion'),
	...require('./formatter'),
	...require('./validator'),
};
