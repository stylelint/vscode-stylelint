import path from 'path';
import pathIsInside from 'path-is-inside';
import type stylelint from 'stylelint';
import { URI } from 'vscode-uri';
import { inject } from '../../../di/index.js';
import { normalizeFsPath } from '../../utils/index.js';
import type { RunnerOptions } from '../../stylelint/types.js';
import {
	NormalizeFsPathToken,
	PathIsInsideToken,
	PathModuleToken,
	UriModuleToken,
} from '../../tokens.js';
import { PackageRootService } from './package-root.service.js';

@inject({
	inject: [
		PathModuleToken,
		PathIsInsideToken,
		UriModuleToken,
		PackageRootService,
		NormalizeFsPathToken,
	],
})
export class StylelintOptionsService {
	readonly #path: typeof path;
	readonly #pathIsInside: typeof pathIsInside;
	readonly #uri: typeof URI;
	readonly #packageRootFinder: PackageRootService;
	readonly #normalizeFsPath: typeof normalizeFsPath;

	constructor(
		pathModule: typeof path,
		pathIsInsideFn: typeof pathIsInside,
		uriModule: typeof URI,
		packageRootFinder: PackageRootService,
		normalizeFsPathFn: typeof normalizeFsPath,
	) {
		this.#path = pathModule;
		this.#pathIsInside = pathIsInsideFn;
		this.#uri = uriModule;
		this.#packageRootFinder = packageRootFinder;
		this.#normalizeFsPath = normalizeFsPathFn;
	}

	async build(
		uri: string,
		workspaceFolder?: string,
		baseOptions: Partial<stylelint.LinterOptions> = {},
		{
			config,
			configFile,
			configBasedir,
			customSyntax,
			ignoreDisables,
			reportDescriptionlessDisables,
			reportNeedlessDisables,
			reportInvalidScopeDisables,
		}: RunnerOptions = {},
	): Promise<Partial<stylelint.LinterOptions>> {
		const pathModule = this.#path;
		const options: Partial<stylelint.LinterOptions> = {
			...baseOptions,
			config: config ?? baseOptions.config,
			configFile: this.#resolvePathTemplate(configFile, workspaceFolder) ?? baseOptions.configFile,
			configBasedir: this.#resolveConfigBasedir(
				configBasedir,
				workspaceFolder,
				baseOptions.configBasedir,
			),
			customSyntax:
				this.#resolvePathTemplate(customSyntax, workspaceFolder) ?? baseOptions.customSyntax,
			ignoreDisables: ignoreDisables ?? baseOptions.ignoreDisables,
			reportDescriptionlessDisables:
				reportDescriptionlessDisables ?? baseOptions.reportDescriptionlessDisables,
			reportNeedlessDisables: reportNeedlessDisables ?? baseOptions.reportNeedlessDisables,
			reportInvalidScopeDisables:
				reportInvalidScopeDisables ?? baseOptions.reportInvalidScopeDisables,
		};

		const documentPath = this.#uri.parse(uri).fsPath;
		const normalizedDocumentPath = documentPath ? this.#normalizeFsPath(documentPath) : undefined;
		const normalizedWorkspaceFolder = workspaceFolder
			? this.#normalizeFsPath(workspaceFolder)
			: undefined;

		if (documentPath) {
			if (
				workspaceFolder &&
				normalizedDocumentPath &&
				normalizedWorkspaceFolder &&
				this.#pathIsInside(normalizedDocumentPath, normalizedWorkspaceFolder)
			) {
				options.ignorePath = pathModule.join(workspaceFolder, '.stylelintignore');
			}

			if (options.ignorePath === undefined) {
				const packageRoot =
					(await this.#packageRootFinder.find(documentPath)) || pathModule.parse(documentPath).root;

				options.ignorePath = pathModule.join(packageRoot, '.stylelintignore');
			}
		}

		return options;
	}

	#resolvePathTemplate(value: string | undefined, workspaceFolder?: string): string | undefined {
		if (!value) {
			return undefined;
		}

		if (!workspaceFolder) {
			return value;
		}

		return value.replace(/\$\{workspaceFolder\}/gu, workspaceFolder);
	}

	#resolveConfigBasedir(
		value: string | undefined,
		workspaceFolder: string | undefined,
		fallback?: string,
	): string | undefined {
		if (!value) {
			return fallback;
		}

		const pathModule = this.#path;

		if (pathModule.isAbsolute(value)) {
			return value;
		}

		if (!workspaceFolder) {
			return value.replace(/^\.\//u, '');
		}

		return pathModule.join(workspaceFolder, value);
	}
}
