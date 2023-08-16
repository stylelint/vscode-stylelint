import type stylelint from 'stylelint';
import { Stylelint } from '../types';
import { processLinterResult } from '../process-linter-result';

const mockStylelint = {
	rules: {
		'unit-no-unknown': {},
		'at-rule-no-unknown': {},
	},
} as unknown as Stylelint;

const createMockResult = (
	mockResults: Partial<stylelint.LintResult>[],
	output?: string,
): stylelint.LinterResult => {
	const results = mockResults.map((result) => ({
		invalidOptionWarnings: result.invalidOptionWarnings ?? [],
		warnings: result.warnings ?? [],
		ignored: result.ignored ?? false,
	}));

	return (output ? { results, output } : { results }) as stylelint.LinterResult;
};

const createMockWarning = (
	rule: string,
	text?: string,
	severity?: stylelint.Severity,
	line?: number,
	column?: number,
): stylelint.Warning => ({
	rule,
	text: text ?? rule,
	severity: severity ?? 'error',
	line: line ?? 1,
	column: column ?? 1,
});

describe('processLinterResult', () => {
	test('should return diagnostics for each warning', () => {
		const result = processLinterResult(
			mockStylelint,
			createMockResult([
				{
					warnings: [
						createMockWarning('unit-no-unknown'),
						createMockWarning('at-rule-no-unknown'),
						createMockWarning('alpha-value-notation'),
					],
				},
			]),
		);

		expect(result).toMatchSnapshot();
	});

	test('should return output if given', () => {
		const result = processLinterResult(
			mockStylelint,
			createMockResult(
				[
					{
						warnings: [createMockWarning('unit-no-unknown')],
					},
				],
				'Output',
			),
		);

		expect(result).toMatchSnapshot();
	});

	test('should return no diagnostics if no results are given', () => {
		const result = processLinterResult(mockStylelint, createMockResult([]));

		expect(result).toEqual({ diagnostics: [] });
	});

	test('should return no diagnostics if results are ignored', () => {
		const result = processLinterResult(
			mockStylelint,
			createMockResult([
				{
					warnings: [createMockWarning('unit-no-unknown')],
					ignored: true,
				},
			]),
		);

		expect(result).toEqual({ diagnostics: [] });
	});

	test('should throw if invalid option results are given', () => {
		expect(() =>
			processLinterResult(
				mockStylelint,
				createMockResult([
					{
						invalidOptionWarnings: [{ text: 'Warning 1' }, { text: 'Warning 2' }],
					},
				]),
			),
		).toThrowErrorMatchingSnapshot();
	});
});
