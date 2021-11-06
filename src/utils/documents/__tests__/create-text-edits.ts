import { TextDocument } from 'vscode-languageserver-textdocument';

import { createTextEdits } from '../create-text-edits';

const createTextDocument = (text: string) =>
	TextDocument.create('file:///test.css', 'css', 1, text);

describe('createTextEdits', () => {
	test('should create text edits for insertions', () => {
		const textDocument = createTextDocument(`
			.foo {
				color: red;
			}
		`);
		const edits = createTextEdits(
			textDocument,
			`
			.foo {
				color: red;
				font-size: 12px;
			}
		`,
		);

		expect(edits).toMatchSnapshot();
	});

	test('should create text edits for deletions', () => {
		const textDocument = createTextDocument(`
			table.foo {
				width: 100%;
				height: 100%;
			}
		`);
		const edits = createTextEdits(
			textDocument,
			`
			table.foo {
				height: 100%;
			}
		`,
		);

		expect(edits).toMatchSnapshot();
	});

	test('should not create text edits without changes', () => {
		const textDocument = createTextDocument(`
			@media (min-width: 768px) {
				.foo {
					color: red;
				}
			}
		`);
		const edits = createTextEdits(
			textDocument,
			`
			@media (min-width: 768px) {
				.foo {
					color: red;
				}
			}
		`,
		);

		expect(edits).toEqual([]);
	});

	test('should create text edits for insertions and deletions', () => {
		const textDocument = createTextDocument(`
			a {
				font-size: 12px;
				font-weight: bold;
			}

			.foo {
				overflow: hidden;
				background: #fff url(/foo.png) no-repeat;
			}
		`);
		const edits = createTextEdits(
			textDocument,
			`
			a {
				font-size: 14px;
			}

			.foo {
				overflow: hidden;
				background: #e2e2e2 url('/bar.png') no-repeat;
			}
		`,
		);

		expect(edits).toMatchSnapshot();
	});
});
