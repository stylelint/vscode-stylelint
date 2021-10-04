'use strict';

const { downloadAndUnzipVSCode } = require('@vscode/test-electron');
const { version, platform } = require('../jest-runner-vscode.config');

downloadAndUnzipVSCode(version, platform);
