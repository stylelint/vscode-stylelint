import { downloadAndUnzipVSCode } from '@vscode/test-electron';
import { version } from '../test/e2e/jest-runner-vscode.config.js';

void downloadAndUnzipVSCode(version);
