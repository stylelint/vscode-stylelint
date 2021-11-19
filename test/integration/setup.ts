import { ConnectionManager } from './connection-manager';

Object.defineProperty(global, 'ConnectionManager', {
	get() {
		return ConnectionManager;
	},
});
