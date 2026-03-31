import {
	LSPErrorCodes,
	ResponseError,
	type CancellationToken,
} from 'vscode-languageserver-protocol';

/**
 * Throws a {@link ResponseError} with {@link LSPErrorCodes.RequestCancelled} if
 * the token is cancelled.
 */
export function throwIfCancelled(token: CancellationToken): void {
	if (token.isCancellationRequested) {
		throw new ResponseError(LSPErrorCodes.RequestCancelled, 'Request cancelled');
	}
}
