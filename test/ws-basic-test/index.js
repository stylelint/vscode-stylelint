'use strict';

const { join } = require('path');

const pWaitFor = require('p-wait-for');
const test = require('tape');
const { extensions, workspace, window, Uri, commands } = require('vscode');

const run = () =>
	test('vscode-stylelint', async (t) => {
		await commands.executeCommand('vscode.openFolder', Uri.file(__dirname));

		const vscodeStylelint = extensions.getExtension('stylelint.vscode-stylelint');

		const plaintextDocument = await workspace.openTextDocument({
			content: 'Hello',
			language: 'plaintext',
		});

		await window.showTextDocument(plaintextDocument);

		t.equal(
			vscodeStylelint.isActive,
			false,
			'should not be activated when the open file is not CSS.',
		);

		const cssDocument = await workspace.openTextDocument({
			content: '}',
			language: 'css',
		});

		await window.showTextDocument(cssDocument);
		await pWaitFor(() => vscodeStylelint.isActive, { timeout: 2000 });

		t.pass('should be activated when the open file is CSS.');

		const htmlDocument = await workspace.openTextDocument({
			content: '}',
			language: 'html',
		});

		await window.showTextDocument(htmlDocument);
		await pWaitFor(() => vscodeStylelint.isActive, 2000);

		t.pass('should be activated when the open file is HTML.');

		const lessDocument = await workspace.openTextDocument({
			content: '}',
			language: 'less',
		});

		await window.showTextDocument(lessDocument);
		await pWaitFor(() => vscodeStylelint.isActive, 2000);

		t.pass('should be activated when the open file is LESS.');

		const markdownDocument = await workspace.openTextDocument({
			content: '}',
			language: 'markdown',
		});

		await window.showTextDocument(markdownDocument);
		await pWaitFor(() => vscodeStylelint.isActive, 2000);

		t.pass('should be activated when the open file is Markdown.');

		const sassDocument = await workspace.openTextDocument({
			content: '}',
			language: 'sass',
		});

		await window.showTextDocument(sassDocument);
		await pWaitFor(() => vscodeStylelint.isActive, 2000);

		t.pass('should be activated when the open file is SASS.');

		const scssDocument = await workspace.openTextDocument({
			content: '}',
			language: 'scss',
		});

		await window.showTextDocument(scssDocument);
		await pWaitFor(() => vscodeStylelint.isActive, 2000);

		t.pass('should be activated when the open file is SCSS.');

		const sugarDocument = await workspace.openTextDocument({
			content: '}',
			language: 'scss',
		});

		await window.showTextDocument(sugarDocument);
		await pWaitFor(() => vscodeStylelint.isActive, 2000);

		t.pass('should be activated when the open file is SUGARSS.');

		t.equal(
			(await workspace.openTextDocument(join(__dirname, '.stylelintignore'))).languageId,
			'ignore',
			'should add syntax highlighting to .stylelintignore.',
		);

		t.end();
	});

exports.run = (root, done) => {
	test.onFinish(done);
	run();
};
