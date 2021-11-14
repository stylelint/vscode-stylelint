import path from 'path';

import * as JSONC from 'jsonc-parser';
import deepEqual from 'fast-deep-equal';
import pWaitFor from 'p-wait-for';
import {
	commands,
	extensions,
	workspace,
	Selection,
	Range,
	Position,
	CodeAction,
	TextEditor,
} from 'vscode';
import { ApiEvent, PublicApi } from '../../../src/extension';

const getCodeActions = async (editor: TextEditor): Promise<CodeAction[]> =>
	(await commands.executeCommand(
		'vscode.executeCodeActionProvider',
		editor.document.uri,
		new Range(editor.selection.start, editor.selection.end),
	)) ?? [];

const serializeCodeActions = (actions: CodeAction[]) =>
	actions.map((action) => ({
		...action,
		...(action.edit ? { edit: action.edit?.entries()?.map(([, edits]) => ['<uri>', edits]) } : {}),
	}));

const cssPath = path.resolve(workspaceDir, 'code-actions/test.css');
const jsPath = path.resolve(workspaceDir, 'code-actions/test.js');
const settingsPath = path.resolve(workspaceDir, 'code-actions/.vscode/settings.json');

const defaultSettings = {
	'stylelint.reportNeedlessDisables': true,
	'stylelint.validate': ['css', 'javascript'],
};

describe('Code actions', () => {
	beforeAll(async () => {
		const api = (await extensions.getExtension('stylelint.vscode-stylelint')?.exports) as PublicApi;

		await pWaitFor(() => api.codeActionReady, { timeout: 5000 });
	});

	afterEach(async () => {
		const settingsEditor = await openDocument(settingsPath);
		const text = settingsEditor.document.getText();
		const settings = JSONC.parse(text) as typeof defaultSettings;
		const areEqual = deepEqual(settings, defaultSettings);

		if (!settingsEditor.document.isDirty && areEqual) {
			return;
		}

		await settingsEditor.edit((editBuilder) => {
			editBuilder.replace(
				new Range(
					settingsEditor.document.positionAt(0),
					settingsEditor.document.positionAt(text.length - 1),
				),
				JSON.stringify(defaultSettings, null, '\t'),
			);
		});

		if (areEqual) {
			await settingsEditor.document.save();

			return;
		}

		const resetPromise = waitForApiEvent(ApiEvent.DidResetConfiguration);

		await settingsEditor.document.save();

		await resetPromise;
	});

	it('should provide code actions for problems', async () => {
		const editor = await openDocument(cssPath);

		await waitForDiagnostics(editor);

		editor.selection = new Selection(new Position(1, 2), new Position(1, 2));

		const actions = await getCodeActions(editor);

		expect(serializeCodeActions(actions)).toMatchSnapshot();
	});

	it('should not provide disable code actions for disable reports', async () => {
		const editor = await openDocument(cssPath);

		await waitForDiagnostics(editor);

		editor.selection = new Selection(new Position(2, 4), new Position(2, 4));

		const actions = await getCodeActions(editor);

		expect(actions).toHaveLength(0);
	});

	it('should disable rules for an entire file', async () => {
		const editor = await openDocument(cssPath);

		await waitForDiagnostics(editor);

		editor.selection = new Selection(new Position(1, 2), new Position(1, 2));

		const actions = await getCodeActions(editor);

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

		const actions = await getCodeActions(editor);

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

		editor.selection = new Selection(new Position(1, 2), new Position(1, 2));

		await waitForDiagnostics(editor);

		const actions = await getCodeActions(editor);
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
				new Position(5, 2),
				',\n\t"stylelint.codeAction.disableRuleComment": { "location": "sameLine" }',
			),
		);

		const resetPromise = waitForApiEvent(ApiEvent.DidResetConfiguration);

		await settingsEditor.document.save();
		await resetPromise;
		//await openDocument(cssPath);
		//await commands.executeCommand('workbench.action.closeActiveEditor');

		const editor = await openDocument(cssPath);

		await waitForDiagnostics(editor);

		editor.selection = new Selection(new Position(1, 2), new Position(1, 2));

		const actions = await getCodeActions(editor);
		const lineAction = actions.find((action) => action.title.match(/^Disable .+ for this line$/));

		expect(lineAction?.edit).toBeDefined();

		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		await workspace.applyEdit(lineAction!.edit!);

		expect(editor.document.getText()).toMatchSnapshot();
	});
});
