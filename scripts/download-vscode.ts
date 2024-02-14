import { downloadAndUnzipVSCode } from '@vscode/test-electron';
import { version, platform } from '../test/e2e/jest-runner-vscode.config';

void downloadAndUnzipVSCode(version, platform).then((executablePath) => {
	console.log(executablePath);
});
