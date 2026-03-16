import process from 'node:process';
import type { ServerOptions } from 'vscode-languageclient/node';

import { inject } from '@stylelint/language-server/di';
import { parseLogLevel } from '@stylelint/language-server/shared/log-level';
import { extensionTokens } from '../di-tokens.js';
import type { VSCodeWorkspace } from './environment.js';

@inject({
	inject: [extensionTokens.serverModulePath, extensionTokens.workspace],
})
export class ServerOptionsService {
	readonly #modulePath: string;
	readonly #workspace: VSCodeWorkspace;

	constructor(modulePath: string, workspace: VSCodeWorkspace) {
		this.#modulePath = modulePath;
		this.#workspace = workspace;
	}

	getServerOptions(): ServerOptions {
		const config = this.#workspace.getConfiguration('stylelint');
		const configuredLogLevel = config.get<string>('logLevel');
		const logLevel = parseLogLevel(configuredLogLevel) ?? 'info';
		const env = { ...process.env, STYLELINT_LOG_LEVEL: logLevel };

		const runtime = config.get<string | null>('runtime', null);
		const execArgv = config.get<string[] | null>('execArgv', null);

		const debugExecArgv = ['--nolazy', '--inspect=6004'];

		return {
			run: {
				module: this.#modulePath,
				...(runtime && { runtime }),
				options: {
					...(execArgv && { execArgv }),
					env,
				},
			},
			debug: {
				module: this.#modulePath,
				...(runtime && { runtime }),
				options: {
					execArgv: execArgv ? [...execArgv, ...debugExecArgv] : debugExecArgv,
					env,
				},
			},
		};
	}
}
