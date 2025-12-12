import type { RemoteConsole } from 'vscode-languageserver/node';
import { getLogFunction } from '../get-log-function.js';
import { vi, describe, it, expect } from 'vitest';

const mockRemoteConsole = {
	connection: {} as never,
	error: vi.fn(),
	warn: vi.fn(),
	info: vi.fn(),
	log: vi.fn(),
} as unknown as RemoteConsole;

describe('getLogFunction', () => {
	it('should return a function when given a supported level', () => {
		expect(getLogFunction(mockRemoteConsole, 'info')).toBe(mockRemoteConsole.info);
	});

	it("should return undefined if the level doesn't have a matching function", () => {
		expect(getLogFunction(mockRemoteConsole, 'foo')).toBeUndefined();
		expect(getLogFunction(mockRemoteConsole, 'connection')).toBeUndefined();
	});
});
