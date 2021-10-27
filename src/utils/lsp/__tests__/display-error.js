'use strict';

const { InvalidOptionError } = require('../../types');

const { displayError } = require('../display-error');

const mockConnection = /** @type {lsp.Connection} */ (
	/** @type {any} */ ({ window: { showErrorMessage: jest.fn() } })
);

describe('displayError', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	test('for non-Error types, should display the value coalesced to a string', () => {
		displayError(mockConnection, Symbol('foo'));

		expect(mockConnection.window.showErrorMessage).toHaveBeenCalledTimes(1);
		expect(mockConnection.window.showErrorMessage).toHaveBeenCalledWith('Symbol(foo)');
	});

	test('for strings, should display the value with newlines replaced with spaces', () => {
		displayError(mockConnection, 'test\nmessage');

		expect(mockConnection.window.showErrorMessage).toHaveBeenCalledTimes(1);
		expect(mockConnection.window.showErrorMessage).toHaveBeenCalledWith('test message');
	});

	test('for invalid option errors, should display an error message for each reason', () => {
		displayError(
			mockConnection,
			new InvalidOptionError([{ text: 'reason 1' }, { text: 'reason 2' }]),
		);

		expect(mockConnection.window.showErrorMessage).toHaveBeenCalledTimes(2);
		expect(mockConnection.window.showErrorMessage).toHaveBeenNthCalledWith(
			1,
			'Stylelint: reason 1',
		);
		expect(mockConnection.window.showErrorMessage).toHaveBeenNthCalledWith(
			2,
			'Stylelint: reason 2',
		);
	});

	test("for configuration errors, should display the error's message property", () => {
		displayError(mockConnection, Object.assign(new Error('test message'), { code: 78 }));

		expect(mockConnection.window.showErrorMessage).toHaveBeenCalledTimes(1);
		expect(mockConnection.window.showErrorMessage).toHaveBeenCalledWith('Stylelint: test message');
	});

	test('for errors, should display the stack with newlines replaced with spaces', () => {
		displayError(
			mockConnection,
			Object.assign(new Error('test message'), { stack: 'test\nstack' }),
		);

		expect(mockConnection.window.showErrorMessage).toHaveBeenCalledTimes(1);
		expect(mockConnection.window.showErrorMessage).toHaveBeenCalledWith('test stack');
	});

	test('for errors without a stack, should display the message with newlines replaced with spaces', () => {
		displayError(mockConnection, Object.assign(new Error('test\nmessage'), { stack: undefined }));

		expect(mockConnection.window.showErrorMessage).toHaveBeenCalledTimes(1);
		expect(mockConnection.window.showErrorMessage).toHaveBeenCalledWith('test message');
	});
});
