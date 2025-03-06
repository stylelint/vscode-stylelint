import { formattingOptionsToRules } from '../formatting-options-to-rules';

describe('formattingOptionsToRules', () => {
	test('should convert insertSpaces and tabSize to an indentation rule', () => {
		expect(formattingOptionsToRules({ insertSpaces: true, tabSize: 2 })).toStrictEqual({
			indentation: [2],
		});
		expect(formattingOptionsToRules({ insertSpaces: false, tabSize: 2 })).toStrictEqual({
			indentation: ['tab'],
		});
	});

	test('should convert insertFinalNewline to a no-missing-end-of-source-newline rule', () => {
		expect(
			formattingOptionsToRules({
				insertSpaces: true,
				tabSize: 2,
				insertFinalNewline: true,
			}),
		).toStrictEqual({
			indentation: [2],
			'no-missing-end-of-source-newline': true,
		});
		expect(
			formattingOptionsToRules({
				insertSpaces: true,
				tabSize: 2,
				insertFinalNewline: false,
			}),
		).toStrictEqual({
			indentation: [2],
			'no-missing-end-of-source-newline': null,
		});
	});

	test('should convert trimTrailingWhitespace to a no-eol-whitespace rule', () => {
		expect(
			formattingOptionsToRules({
				insertSpaces: true,
				tabSize: 2,
				trimTrailingWhitespace: true,
			}),
		).toStrictEqual({
			indentation: [2],
			'no-eol-whitespace': true,
		});
		expect(
			formattingOptionsToRules({
				insertSpaces: true,
				tabSize: 2,
				trimTrailingWhitespace: false,
			}),
		).toStrictEqual({
			indentation: [2],
			'no-eol-whitespace': null,
		});
	});

	test('should ignore trimFinalNewlines', () => {
		expect(
			formattingOptionsToRules({
				insertSpaces: true,
				tabSize: 2,
				trimFinalNewlines: false,
			}),
		).toStrictEqual({
			indentation: [2],
		});
		expect(
			formattingOptionsToRules({
				insertSpaces: true,
				tabSize: 2,
				trimFinalNewlines: true,
			}),
		).toStrictEqual({
			indentation: [2],
		});
	});
});
