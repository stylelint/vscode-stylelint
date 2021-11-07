'use strict';

const path = require('path');

/** @type {import('jest-runner-vscode').RunnerOptions} */
const config = {
	workspaceDir: path.join(__dirname, 'workspace'),
};

module.exports = config;
