import * as serverMocks from './server-mocks';

Object.defineProperty(global, 'serverMocks', {
	get() {
		return serverMocks;
	},
});
