'use strict';

const { getLogFunction } = require('../get-log-function');

/** @type {lsp.RemoteConsole} */
const mockRemoteConsole = {
	connection: /** @type {any} */ ({}),
	error: jest.fn(),
	warn: jest.fn(),
	info: jest.fn(),
	log: jest.fn(),
};

describe('getLogFunction', () => {
	it('should return a function when given a supported level', () => {
		expect(getLogFunction(mockRemoteConsole, 'info')).toBe(mockRemoteConsole.info);
	});

	it("should return undefined if the level doesn't have a matching function", () => {
		expect(getLogFunction(mockRemoteConsole, 'foo')).toBeUndefined();
		expect(getLogFunction(mockRemoteConsole, 'connection')).toBeUndefined();
	});
});
