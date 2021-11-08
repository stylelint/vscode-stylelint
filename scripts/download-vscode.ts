import { downloadAndUnzipVSCode } from '@vscode/test-electron';
import { version, platform } from '../test/e2e/jest-runner-vscode.config';

downloadAndUnzipVSCode(version, platform);
