'use strict';

const path = require('path');
const { workspace, window } = require('vscode');

async function run() {
	const cssDocument = await workspace.openTextDocument(path.resolve(__dirname, 'test.css'));

	await window.showTextDocument(cssDocument);
	require('console').log('waiting!');
	// Waits forever using a promise that never resolves.
	await new Promise(() => {});
	require('console').log('shit!');
}

module.exports = { run };
