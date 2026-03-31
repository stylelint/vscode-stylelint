import { describe, expect, it } from 'vitest';
import {
	LSPErrorCodes,
	ResponseError,
	type CancellationToken,
} from 'vscode-languageserver-protocol';
import { throwIfCancelled } from '../throw-if-cancelled.js';

function createMockToken(cancelled: boolean): CancellationToken {
	return {
		get isCancellationRequested() {
			return cancelled;
		},
		onCancellationRequested: () => ({ dispose() {} }),
	};
}

describe('throwIfCancelled', () => {
	it('should throw ResponseError with RequestCancelled when token is cancelled', () => {
		expect(() => throwIfCancelled(createMockToken(true))).toThrow(
			expect.objectContaining({
				code: LSPErrorCodes.RequestCancelled,
			}),
		);
	});

	it('should throw a ResponseError instance', () => {
		expect(() => throwIfCancelled(createMockToken(true))).toThrow(ResponseError);
	});

	it('should not throw when token is not cancelled', () => {
		expect(() => throwIfCancelled(createMockToken(false))).not.toThrow();
	});
});
