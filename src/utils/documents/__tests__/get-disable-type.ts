import { getDisableType } from '../get-disable-type';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Position } from 'vscode-languageserver-types';

const createTextDocument = (code: string) =>
	TextDocument.create('file:///path/to/file.css', 'css', 1, code);

describe('getDisableType', () => {
	test("if the position is after a disable comment's type, should return its type", () => {
		const code = '\n/* stylelint-disable indentation */\na {}';
		const position = Position.create(1, 21);

		const document = createTextDocument(code);

		expect(getDisableType(document, position)).toBe('stylelint-disable');
	});

	test("if the position is before the end of a disable comment's type, should return undefined", () => {
		const code = '\n/* stylelint-disable indentation */\na {}';
		const position = Position.create(1, 20);

		const document = createTextDocument(code);

		expect(getDisableType(document, position)).toBeUndefined();
	});

	test('if the position is not inside a disable comment, should return undefined', () => {
		const code = '\na {}';
		const position = Position.create(1, 1);

		const document = createTextDocument(code);

		expect(getDisableType(document, position)).toBeUndefined();
	});

	test('if the position is inside a disable comment with a broken end, should return undefined', () => {
		const code = '\n/* stylelint-disable indentation \na {}';
		const position = Position.create(1, 21);

		const document = createTextDocument(code);

		expect(getDisableType(document, position)).toBeUndefined();
	});
});
