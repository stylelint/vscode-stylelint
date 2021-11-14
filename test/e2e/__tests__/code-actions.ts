import path from 'path';

import pWaitFor from 'p-wait-for';
import { getStylelintDiagnostics } from '../utils';
import {
	commands,
	extensions,
	workspace,
	window,
	Selection,
	Range,
	Position,
	CodeAction,
	Uri,
	TextEditor,
} from 'vscode';
import { ApiEvent, PublicApi } from '../../../src/extension';

const getCodeActions = async (uri: Uri, range: Range): Promise<CodeAction[]> =>
	(await commands.executeCommand('vscode.executeCodeActionProvider', uri, range)) ?? [];

const serializeCodeActions = (actions: CodeAction[]) =>
	actions.map((action) => ({
		...action,
		...(action.edit ? { edit: action.edit?.entries()?.map(([, edits]) => ['<uri>', edits]) } : {}),
	}));

const cssPath = path.resolve(workspaceDir, 'code-actions/test.css');
const jsPath = path.resolve(workspaceDir, 'code-actions/test.js');
const settingsPath = path.resolve(workspaceDir, 'code-actions/.vscode/settings.json');

const defaultSettings = `{
	"stylelint.reportNeedlessDisables": true,
	"stylelint.validate": ["css", "javascript"]
}
`;

const openDocument = async (filePath: string): Promise<TextEditor> => {
	const cssDocument = await workspace.openTextDocument(filePath);

	const editor = await window.showTextDocument(cssDocument);

	return editor;
};

const waitForDiagnostics = (editor: TextEditor): Promise<void> =>
	pWaitFor(() => getStylelintDiagnostics(editor.document.uri).length > 0, { timeout: 5000 });

const waitForConfigurationReset = async (): Promise<void> => {
	const api = (await extensions.getExtension('stylelint.vscode-stylelint')?.exports) as PublicApi;

	return new Promise<void>((resolve, reject) => {
		api.on(ApiEvent.DidResetConfiguration, resolve);

		setTimeout(() => {
			reject(new Error('Timed out waiting for DidResetConfiguration event'));
		}, 5000);
	});
};

describe('Code actions', () => {
	afterEach(async () => {
		for (const filePath of [cssPath, jsPath]) {
			const editor = await openDocument(filePath);

			while (editor.document.isDirty) {
				await commands.executeCommand('undo');
			}
		}

		const settingsEditor = await openDocument(settingsPath);

		if (!settingsEditor.document.isDirty && settingsEditor.document.getText() === defaultSettings) {
			return;
		}

		await settingsEditor.edit((editBuilder) => {
			editBuilder.replace(
				new Range(
					new Position(0, 0),
					settingsEditor.document.lineAt(settingsEditor.document.lineCount - 1).range.end,
				),
				defaultSettings,
			);
		});

		const resetPromise = waitForConfigurationReset();

		await settingsEditor.document.save();

		await resetPromise;
	});

	it('should provide code actions for problems', async () => {
		const editor = await openDocument(cssPath);

		await waitForDiagnostics(editor);

		editor.selection = new Selection(new Position(1, 2), new Position(1, 2));

		const actions = await getCodeActions(editor.document.uri, editor.selection);

		expect(serializeCodeActions(actions)).toMatchSnapshot();
	});

	it('should not provide disable code actions for disable reports', async () => {
		const editor = await openDocument(cssPath);

		await waitForDiagnostics(editor);

		editor.selection = new Selection(new Position(2, 4), new Position(2, 4));

		const actions = await getCodeActions(editor.document.uri, editor.selection);

		expect(actions).toHaveLength(0);
	});

	it('should disable rules for an entire file', async () => {
		const editor = await openDocument(cssPath);

		await waitForDiagnostics(editor);

		editor.selection = new Selection(new Position(1, 2), new Position(1, 2));

		const actions = await getCodeActions(editor.document.uri, editor.selection);

		const fileAction = actions.find((action) =>
			action.title.match(/^Disable .+ for the entire file$/),
		);

		expect(fileAction?.edit).toBeDefined();

		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		await workspace.applyEdit(fileAction!.edit!);

		expect(editor.document.getText()).toMatchSnapshot();
	});

	it('should disable rules for an entire file with a shebang', async () => {
		const editor = await openDocument(jsPath);

		await waitForDiagnostics(editor);

		editor.selection = new Selection(new Position(6, 9), new Position(6, 9));

		const actions = await getCodeActions(editor.document.uri, editor.selection);

		const fileAction = actions.find((action) =>
			action.title.match(/^Disable .+ for the entire file$/),
		);

		expect(fileAction?.edit).toBeDefined();

		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		await workspace.applyEdit(fileAction!.edit!);

		expect(editor.document.getText()).toMatchSnapshot();
	});

	it('should disable rules for a specific line with a comment on the previous line', async () => {
		const editor = await openDocument(cssPath);

		await waitForDiagnostics(editor);

		editor.selection = new Selection(new Position(1, 2), new Position(1, 2));

		const actions = await getCodeActions(editor.document.uri, editor.selection);

		const lineAction = actions.find((action) => action.title.match(/^Disable .+ for this line$/));

		expect(lineAction?.edit).toBeDefined();

		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		await workspace.applyEdit(lineAction!.edit!);

		expect(editor.document.getText()).toMatchSnapshot();
	});

	it('should disable rules for a specific line with a comment on the same line', async () => {
		const settingsEditor = await openDocument(settingsPath);

		await settingsEditor.edit((edit) =>
			edit.insert(
				new Position(2, 44),
				',\n\t"stylelint.codeAction.disableRuleComment": { "location": "sameLine" }',
			),
		);

		const resetPromise = waitForConfigurationReset();

		await settingsEditor.document.save();
		await resetPromise;
		await openDocument(cssPath);
		await commands.executeCommand('workbench.action.closeActiveEditor');

		const editor = await openDocument(cssPath);

		await waitForDiagnostics(editor);

		editor.selection = new Selection(new Position(1, 2), new Position(1, 2));

		const actions = await getCodeActions(editor.document.uri, editor.selection);
		const lineAction = actions.find((action) => action.title.match(/^Disable .+ for this line$/));

		expect(lineAction?.edit).toBeDefined();

		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		await workspace.applyEdit(lineAction!.edit!);

		expect(editor.document.getText()).toMatchSnapshot();
	});
});
