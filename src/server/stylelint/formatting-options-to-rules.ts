import type LSP from 'vscode-languageserver-protocol';

export type FormattingRules = {
	indentation?: [number | string];
	'no-missing-end-of-source-newline'?: true | null;
	'no-eol-whitespace'?: true | null;
};

/**
 * Converts the given formatting options to rules.
 * @param options The formatting options.
 * @returns The rules.
 */
export function formattingOptionsToRules({
	insertSpaces,
	tabSize,
	insertFinalNewline,
	trimTrailingWhitespace,
}: LSP.FormattingOptions): FormattingRules {
	// NOTE: There is no equivalent rule for trimFinalNewlines, so it is not respected.

	const rules: FormattingRules = {
		indentation: [insertSpaces ? tabSize : 'tab'],
	};

	if (insertFinalNewline !== undefined) {
		rules['no-missing-end-of-source-newline'] = insertFinalNewline || null;
	}

	if (trimTrailingWhitespace !== undefined) {
		rules['no-eol-whitespace'] = trimTrailingWhitespace || null;
	}

	return rules;
}
