import { describe, expect, test } from 'vitest';
import { createDisableCompletionItem } from '../create-disable-completion-item.js';

describe('createDisableCompletionItem', () => {
	test('should create a stylelint-disable completion item', () => {
		const result = createDisableCompletionItem('stylelint-disable');

		expect(result).toMatchSnapshot();
	});

	test('should create a stylelint-disable completion item for a specific rule', () => {
		const result = createDisableCompletionItem('stylelint-disable', 'indentation');

		expect(result).toMatchSnapshot();
	});

	test('should create a stylelint-disable-line completion item', () => {
		const result = createDisableCompletionItem('stylelint-disable-line');

		expect(result).toMatchSnapshot();
	});

	test('should create a stylelint-disable-line completion item for a specific rule', () => {
		const result = createDisableCompletionItem('stylelint-disable-line', 'indentation');

		expect(result).toMatchSnapshot();
	});

	test('should create a stylelint-disable-next-line completion item', () => {
		const result = createDisableCompletionItem('stylelint-disable-next-line');

		expect(result).toMatchSnapshot();
	});

	test('should create a stylelint-disable-next-line completion item for a specific rule', () => {
		const result = createDisableCompletionItem('stylelint-disable-next-line', 'indentation');

		expect(result).toMatchSnapshot();
	});
});
