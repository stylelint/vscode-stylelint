/* eslint-disable node/no-unpublished-require */
'use strict';

const { join } = require('path');

const { extensions, workspace, window } = require('vscode');
const pWaitFor = require('p-wait-for');
const test = require('tape');

const run = () =>
	test('vscode-stylelint', async (t) => {
		const vscodeStylelint = extensions.getExtension('thibaudcolas.stylelint');

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
		await pWaitFor(() => vscodeStylelint.isActive, 2000);

		t.pass('should be activated when the open file is CSS.');

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
