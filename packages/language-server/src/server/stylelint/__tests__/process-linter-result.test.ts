import { describe, expect, test } from 'vitest';
import { LinterResult, type default as stylelint } from 'stylelint';
import { processLinterResult, processMultiFileLinterResult } from '../process-linter-result.js';
import {
	Stylelint,
	createRuleMetadataSourceFromStylelint,
	type LinterResult as InternalLinterResult,
} from '../types.js';
import { createTestLogger } from '../../../../../../test/helpers/test-logger.js';

/** For compatibility with Stylelint versions prior to 17.x */
type OldLinterResult = LinterResult & { output: string };

const mockStylelint = {
	rules: {
		'unit-no-unknown': {},
		'at-rule-no-unknown': {},
	},
} as unknown as Stylelint;
const metadataSource = createRuleMetadataSourceFromStylelint(mockStylelint)!;

const createMockResult = (
	mockResults: Partial<stylelint.LintResult>[],
	extra: Partial<stylelint.LinterResult> = {},
): stylelint.LinterResult => {
	const results = mockResults.map((result) => ({
		invalidOptionWarnings: result.invalidOptionWarnings ?? [],
		warnings: result.warnings ?? [],
		ignored: result.ignored ?? false,
	}));

	return { results, ...extra } as stylelint.LinterResult;
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

const logger = createTestLogger();

describe('processLinterResult', () => {
	test('should return diagnostics for each warning', () => {
		const result = processLinterResult(
			metadataSource,
			createMockResult([
				{
					warnings: [
						createMockWarning('unit-no-unknown'),
						createMockWarning('at-rule-no-unknown'),
						createMockWarning('alpha-value-notation'),
					],
				},
			]),
			logger,
		);

		expect(result).toMatchSnapshot();
	});

	test('should include legacy output when provided', () => {
		const result = processLinterResult(
			metadataSource,
			createMockResult(
				[
					{
						warnings: [createMockWarning('unit-no-unknown')],
					},
				],
				{ output: 'Output' } as OldLinterResult,
			),
			logger,
		);

		expect(result).toMatchSnapshot();
	});

	test('should ignore legacy output when code is present', () => {
		const result = processLinterResult(
			metadataSource,
			createMockResult(
				[
					{
						warnings: [createMockWarning('unit-no-unknown')],
					},
				],
				{ output: 'legacy body {}', code: 'modern body {}' } as OldLinterResult,
			),
			logger,
		);

		expect(result.code).toBe('modern body {}');
		expect(result.output).toBeUndefined();
	});

	test('should ignore legacy output when report is present', () => {
		const result = processLinterResult(
			metadataSource,
			createMockResult(
				[
					{
						warnings: [createMockWarning('unit-no-unknown')],
					},
				],
				{ output: 'legacy body {}', report: 'Report' } as OldLinterResult,
			),
			logger,
		);

		expect(result.report).toBe('Report');
		expect(result.output).toBeUndefined();
	});

	test('should include report when provided', () => {
		const result = processLinterResult(
			metadataSource,
			createMockResult(
				[
					{
						warnings: [createMockWarning('unit-no-unknown')],
					},
				],
				{ report: 'Report' },
			),
			logger,
		);

		expect(result).toMatchSnapshot();
	});

	test('should include code when provided', () => {
		const result = processLinterResult(
			metadataSource,
			createMockResult(
				[
					{
						warnings: [createMockWarning('unit-no-unknown')],
					},
				],
				{ code: 'body {}' },
			),
			logger,
		);

		expect(result).toMatchSnapshot();
	});

	test('should return no diagnostics if no results are given', () => {
		const result = processLinterResult(metadataSource, createMockResult([]), logger);

		expect(result).toEqual({ diagnostics: [] });
	});

	test('should return no diagnostics if results are ignored', () => {
		const result = processLinterResult(
			metadataSource,
			createMockResult([
				{
					warnings: [createMockWarning('unit-no-unknown')],
					ignored: true,
				},
			]),
			logger,
		);

		expect(result).toEqual({ diagnostics: [] });
	});

	test('should throw if invalid option results are given', () => {
		expect(() =>
			processLinterResult(
				metadataSource,
				createMockResult([
					{
						invalidOptionWarnings: [{ text: 'Warning 1' }, { text: 'Warning 2' }],
					},
				]),
				logger,
			),
		).toThrowErrorMatchingSnapshot();
	});
});

describe('processMultiFileLinterResult', () => {
	test('should return diagnostics keyed by file source', () => {
		const result = processMultiFileLinterResult(
			metadataSource,
			{
				results: [
					{
						source: '/path/to/file1.css',
						warnings: [createMockWarning('unit-no-unknown')],
						invalidOptionWarnings: [],
						ignored: false,
					},
					{
						source: '/path/to/file2.css',
						warnings: [createMockWarning('at-rule-no-unknown')],
						invalidOptionWarnings: [],
						ignored: false,
					},
				],
			} as InternalLinterResult,
			logger,
		);

		expect(result.size).toBe(2);
		expect(result.has('/path/to/file1.css')).toBe(true);
		expect(result.has('/path/to/file2.css')).toBe(true);
		expect(result.get('/path/to/file1.css')!.diagnostics).toHaveLength(1);
		expect(result.get('/path/to/file2.css')!.diagnostics).toHaveLength(1);
	});

	test('should skip results without a source', () => {
		const result = processMultiFileLinterResult(
			metadataSource,
			{
				results: [
					{
						warnings: [createMockWarning('unit-no-unknown')],
						invalidOptionWarnings: [],
						ignored: false,
					},
					{
						source: '/path/to/file.css',
						warnings: [createMockWarning('at-rule-no-unknown')],
						invalidOptionWarnings: [],
						ignored: false,
					},
				],
			} as InternalLinterResult,
			logger,
		);

		expect(result.size).toBe(1);
		expect(result.has('/path/to/file.css')).toBe(true);
	});

	test('should skip ignored results', () => {
		const result = processMultiFileLinterResult(
			metadataSource,
			{
				results: [
					{
						source: '/path/to/file.css',
						warnings: [createMockWarning('unit-no-unknown')],
						invalidOptionWarnings: [],
						ignored: true,
					},
				],
			} as InternalLinterResult,
			logger,
		);

		expect(result.size).toBe(0);
	});

	test('should return empty map when no results', () => {
		const result = processMultiFileLinterResult(
			metadataSource,
			{ results: [] } as InternalLinterResult,
			logger,
		);

		expect(result.size).toBe(0);
	});

	test('should throw on invalid option warnings', () => {
		expect(() =>
			processMultiFileLinterResult(
				metadataSource,
				{
					results: [
						{
							source: '/path/to/file.css',
							warnings: [],
							invalidOptionWarnings: [{ text: 'Invalid option' }],
							ignored: false,
						},
					],
				} as InternalLinterResult,
				logger,
			),
		).toThrow('Invalid option');
	});

	test('should handle multiple warnings per file', () => {
		const result = processMultiFileLinterResult(
			metadataSource,
			{
				results: [
					{
						source: '/path/to/file.css',
						warnings: [
							createMockWarning('unit-no-unknown'),
							createMockWarning('at-rule-no-unknown'),
						],
						invalidOptionWarnings: [],
						ignored: false,
					},
				],
			} as InternalLinterResult,
			logger,
		);

		expect(result.size).toBe(1);
		expect(result.get('/path/to/file.css')!.diagnostics).toHaveLength(2);
	});
});
