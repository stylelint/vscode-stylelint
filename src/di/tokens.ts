export type Token<T> = symbol & { __type?: T };

export type TokenType<T extends Token<unknown>> = T extends Token<infer R> ? R : never;

/**
 * Creates a unique token for dependency injection.
 */
export function createToken<T>(description: string): Token<T> {
	return Symbol(description) as Token<T>;
}
