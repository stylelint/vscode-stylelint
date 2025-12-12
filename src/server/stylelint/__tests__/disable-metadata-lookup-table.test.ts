import { Range } from 'vscode-languageserver-types';
import type LSP from 'vscode-languageserver-protocol';
import { DisableReportRuleNames } from '../types.js';
import { DisableMetadataLookupTable } from '../disable-metadata-lookup-table.js';
import { describe, expect, test } from 'vitest';

type DisableDiagnosticOptions = {
	disableType: DisableReportRuleNames;
	rule: string;
	range: Range;
};

const createDisableDiagnostic = ({
	disableType,
	rule,
	range,
}: DisableDiagnosticOptions): LSP.Diagnostic => {
	let message = '';

	switch (disableType) {
		case DisableReportRuleNames.Needless:
			message = `Needless disable for "${rule}"`;
			break;

		case DisableReportRuleNames.InvalidScope:
			message = `Rule "${rule}" isn't enabled`;
			break;

		case DisableReportRuleNames.Descriptionless:
			message = `Disable for "${rule}" is missing a description`;
			break;

		case DisableReportRuleNames.Illegal:
			message = `Rule "${rule}" may not be disabled`;
			break;
	}

	return {
		message,
		range,
		code: disableType,
	};
};

describe('DisableMetadataLookupTable', () => {
	test('should be constructable', () => {
		expect(() => new DisableMetadataLookupTable([])).not.toThrow();
	});

	test('should look up disable reports by type', () => {
		const table = new DisableMetadataLookupTable([
			{
				code: 'indentation',
				message: 'Expected indentation of 4 spaces',
				range: Range.create(7, 8, 7, 1),
			},
			createDisableDiagnostic({
				disableType: DisableReportRuleNames.Needless,
				rule: 'foo',
				range: Range.create(4, 2, 7, 5),
			}),
			createDisableDiagnostic({
				disableType: DisableReportRuleNames.InvalidScope,
				rule: 'bar',
				range: Range.create(5, 2, 3, 3),
			}),
			createDisableDiagnostic({
				disableType: DisableReportRuleNames.Descriptionless,
				rule: 'baz',
				range: Range.create(1, 3, 1, 2),
			}),
		]);

		expect(table.find({ type: DisableReportRuleNames.Needless })).toStrictEqual(
			new Set([
				createDisableDiagnostic({
					disableType: DisableReportRuleNames.Needless,
					rule: 'foo',
					range: Range.create(4, 2, 7, 5),
				}),
			]),
		);
	});

	test('should look up disable reports by rule', () => {
		const table = new DisableMetadataLookupTable([
			{
				code: 'indentation',
				message: 'Expected indentation of 4 spaces',
				range: Range.create(7, 8, 7, 1),
			},
			createDisableDiagnostic({
				disableType: DisableReportRuleNames.Needless,
				rule: 'foo',
				range: Range.create(4, 2, 7, 5),
			}),
			createDisableDiagnostic({
				disableType: DisableReportRuleNames.InvalidScope,
				rule: 'bar',
				range: Range.create(5, 2, 3, 3),
			}),
			createDisableDiagnostic({
				disableType: DisableReportRuleNames.Descriptionless,
				rule: 'baz',
				range: Range.create(1, 3, 1, 2),
			}),
		]);

		expect(table.find({ rule: 'bar' })).toStrictEqual(
			new Set([
				createDisableDiagnostic({
					disableType: DisableReportRuleNames.InvalidScope,
					rule: 'bar',
					range: Range.create(5, 2, 3, 3),
				}),
			]),
		);
	});

	test('should look up disable reports by range', () => {
		const table = new DisableMetadataLookupTable([
			{
				code: 'indentation',
				message: 'Expected indentation of 4 spaces',
				range: Range.create(7, 8, 7, 1),
			},
			createDisableDiagnostic({
				disableType: DisableReportRuleNames.Needless,
				rule: 'foo',
				range: Range.create(4, 2, 7, 5),
			}),
			createDisableDiagnostic({
				disableType: DisableReportRuleNames.InvalidScope,
				rule: 'bar',
				range: Range.create(5, 2, 3, 3),
			}),
			createDisableDiagnostic({
				disableType: DisableReportRuleNames.Descriptionless,
				rule: 'baz',
				range: Range.create(1, 3, 1, 2),
			}),
		]);

		expect(table.find({ range: Range.create(1, 3, 1, 2) })).toStrictEqual(
			new Set([
				createDisableDiagnostic({
					disableType: DisableReportRuleNames.Descriptionless,
					rule: 'baz',
					range: Range.create(1, 3, 1, 2),
				}),
			]),
		);
	});

	test('should look up disable reports by type and rule', () => {
		const table = new DisableMetadataLookupTable([
			{
				code: 'indentation',
				message: 'Expected indentation of 4 spaces',
				range: Range.create(7, 8, 7, 1),
			},
			createDisableDiagnostic({
				disableType: DisableReportRuleNames.Needless,
				rule: 'foo',
				range: Range.create(6, 8, 5, 2),
			}),
			createDisableDiagnostic({
				disableType: DisableReportRuleNames.InvalidScope,
				rule: 'foo',
				range: Range.create(3, 2, 4, 3),
			}),
			createDisableDiagnostic({
				disableType: DisableReportRuleNames.Needless,
				rule: 'bar',
				range: Range.create(9, 7, 1, 2),
			}),
			createDisableDiagnostic({
				disableType: DisableReportRuleNames.InvalidScope,
				rule: 'bar',
				range: Range.create(8, 1, 6, 8),
			}),
		]);

		expect(table.find({ type: DisableReportRuleNames.Needless, rule: 'foo' })).toStrictEqual(
			new Set([
				createDisableDiagnostic({
					disableType: DisableReportRuleNames.Needless,
					rule: 'foo',
					range: Range.create(6, 8, 5, 2),
				}),
			]),
		);
	});

	test('should look up disable reports by type and range', () => {
		const table = new DisableMetadataLookupTable([
			{
				code: 'indentation',
				message: 'Expected indentation of 4 spaces',
				range: Range.create(7, 8, 7, 1),
			},
			createDisableDiagnostic({
				disableType: DisableReportRuleNames.Descriptionless,
				rule: 'foo',
				range: Range.create(6, 8, 5, 2),
			}),
			createDisableDiagnostic({
				disableType: DisableReportRuleNames.Illegal,
				rule: 'bar',
				range: Range.create(6, 8, 5, 2),
			}),
			createDisableDiagnostic({
				disableType: DisableReportRuleNames.Descriptionless,
				rule: 'baz',
				range: Range.create(9, 7, 1, 2),
			}),
			createDisableDiagnostic({
				disableType: DisableReportRuleNames.Illegal,
				rule: 'qux',
				range: Range.create(9, 7, 1, 2),
			}),
		]);

		expect(
			table.find({
				type: DisableReportRuleNames.Descriptionless,
				range: Range.create(9, 7, 1, 2),
			}),
		).toStrictEqual(
			new Set([
				createDisableDiagnostic({
					disableType: DisableReportRuleNames.Descriptionless,
					rule: 'baz',
					range: Range.create(9, 7, 1, 2),
				}),
			]),
		);
	});

	test('should look up disable reports by rule and range', () => {
		const table = new DisableMetadataLookupTable([
			{
				code: 'indentation',
				message: 'Expected indentation of 4 spaces',
				range: Range.create(7, 8, 7, 1),
			},
			createDisableDiagnostic({
				disableType: DisableReportRuleNames.Needless,
				rule: 'foo',
				range: Range.create(6, 8, 5, 2),
			}),
			createDisableDiagnostic({
				disableType: DisableReportRuleNames.InvalidScope,
				rule: 'foo',
				range: Range.create(3, 2, 4, 3),
			}),
			createDisableDiagnostic({
				disableType: DisableReportRuleNames.Descriptionless,
				rule: 'bar',
				range: Range.create(6, 8, 5, 2),
			}),
			createDisableDiagnostic({
				disableType: DisableReportRuleNames.Illegal,
				rule: 'bar',
				range: Range.create(8, 1, 6, 8),
			}),
		]);

		expect(table.find({ rule: 'foo', range: Range.create(6, 8, 5, 2) })).toStrictEqual(
			new Set([
				createDisableDiagnostic({
					disableType: DisableReportRuleNames.Needless,
					rule: 'foo',
					range: Range.create(6, 8, 5, 2),
				}),
			]),
		);
	});

	test('should look up disable reports by type, rule and range', () => {
		const table = new DisableMetadataLookupTable([
			{
				code: 'indentation',
				message: 'Expected indentation of 4 spaces',
				range: Range.create(7, 8, 7, 1),
			},
			createDisableDiagnostic({
				disableType: DisableReportRuleNames.Needless,
				rule: 'foo',
				range: Range.create(6, 8, 5, 2),
			}),
			createDisableDiagnostic({
				disableType: DisableReportRuleNames.InvalidScope,
				rule: 'foo',
				range: Range.create(3, 2, 4, 3),
			}),
			createDisableDiagnostic({
				disableType: DisableReportRuleNames.Descriptionless,
				rule: 'foo',
				range: Range.create(6, 8, 5, 2),
			}),
			createDisableDiagnostic({
				disableType: DisableReportRuleNames.Needless,
				rule: 'bar',
				range: Range.create(6, 8, 5, 2),
			}),
			createDisableDiagnostic({
				disableType: DisableReportRuleNames.Needless,
				rule: 'foo',
				range: Range.create(3, 2, 4, 3),
			}),
		]);

		expect(
			table.find({
				type: DisableReportRuleNames.Needless,
				rule: 'foo',
				range: Range.create(6, 8, 5, 2),
			}),
		).toStrictEqual(
			new Set([
				createDisableDiagnostic({
					disableType: DisableReportRuleNames.Needless,
					rule: 'foo',
					range: Range.create(6, 8, 5, 2),
				}),
			]),
		);
	});

	test('should return an empty set if given no parameters', () => {
		const table = new DisableMetadataLookupTable([
			{
				code: 'indentation',
				message: 'Expected indentation of 4 spaces',
				range: Range.create(7, 8, 7, 1),
			},
			createDisableDiagnostic({
				disableType: DisableReportRuleNames.Needless,
				rule: 'foo',
				range: Range.create(4, 2, 7, 5),
			}),
			createDisableDiagnostic({
				disableType: DisableReportRuleNames.InvalidScope,
				rule: 'bar',
				range: Range.create(5, 2, 3, 3),
			}),
			createDisableDiagnostic({
				disableType: DisableReportRuleNames.Descriptionless,
				rule: 'baz',
				range: Range.create(1, 3, 1, 2),
			}),
		]);

		expect(table.find({})).toStrictEqual(new Set());
	});
});
