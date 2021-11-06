import { downloadAndUnzipVSCode } from '@vscode/test-electron';
import { version, platform } from '../jest-runner-vscode.config';

downloadAndUnzipVSCode(version, platform);
