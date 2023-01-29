import type { RemoteConsole } from 'vscode-languageserver/node';
import { getLogFunction } from '../get-log-function';

const mockRemoteConsole: RemoteConsole = {
	connection: {} as never,
	error: jest.fn(),
	warn: jest.fn(),
	info: jest.fn(),
	log: jest.fn(),
	initialize(): void {
		throw new Error('Function not implemented.');
	},
	fillServerCapabilities(): void {
		throw new Error('Function not implemented.');
	},
};

describe('getLogFunction', () => {
	it('should return a function when given a supported level', () => {
		// https://github.com/jest-community/eslint-plugin-jest/issues/985
		expect(getLogFunction(mockRemoteConsole, 'info')).toBe(mockRemoteConsole.info);
	});

	it("should return undefined if the level doesn't have a matching function", () => {
		expect(getLogFunction(mockRemoteConsole, 'foo')).toBeUndefined();
		expect(getLogFunction(mockRemoteConsole, 'connection')).toBeUndefined();
	});
});
