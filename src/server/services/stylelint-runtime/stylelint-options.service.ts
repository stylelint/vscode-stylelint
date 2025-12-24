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
		runnerOptions: RunnerOptions = {},
	): Promise<Partial<stylelint.LinterOptions>> {
		const {
			config,
			configFile,
			configBasedir,
			customSyntax,
			ignoreDisables,
			reportDescriptionlessDisables,
			reportNeedlessDisables,
			reportInvalidScopeDisables,
		} = runnerOptions;
		const runnerOptionsProvided = Object.keys(runnerOptions).length > 0;
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
		const packageRoot = normalizedDocumentPath
			? await this.#packageRootFinder.find(normalizedDocumentPath)
			: undefined;
		const normalizedPackageRoot = packageRoot ? this.#normalizeFsPath(packageRoot) : undefined;
		const normalizedDocumentDir = normalizedDocumentPath
			? pathModule.dirname(normalizedDocumentPath)
			: undefined;
		const packageWithinWorkspace = Boolean(
			normalizedPackageRoot &&
			normalizedWorkspaceFolder &&
			this.#pathIsInside(normalizedPackageRoot, normalizedWorkspaceFolder),
		);
		const documentInWorkspace = Boolean(
			normalizedDocumentPath &&
			normalizedWorkspaceFolder &&
			this.#pathIsInside(normalizedDocumentPath, normalizedWorkspaceFolder),
		);

		// Working directory selection rules:
		//
		// - If caller provided cwd and the document is inside the workspace,
		//   keep the caller's cwd.
		// - If caller provided cwd and the document is outside the workspace,
		//   prefer the package root if it exists and is not inside the
		//   workspace, otherwise use the workspace folder if given.
		// - If caller did not provide cwd, prefer the package root.
		// - If no package root is found, use the workspace folder when
		//   available.
		// - Fall back to the document directory as a last resort.
		//
		// This ensures that linting is done relative to the correct context,
		// which in turn makes sure that .stylelintignore and local configs
		// work as expected in monorepos and packages otherwise deeper in the
		// workspace tree.

		const cwd = (() => {
			if (options.cwd && runnerOptionsProvided) {
				return options.cwd;
			}

			if (options.cwd) {
				if (documentInWorkspace) {
					return options.cwd;
				}

				if (normalizedPackageRoot && !packageWithinWorkspace) {
					return normalizedPackageRoot;
				}

				return normalizedWorkspaceFolder ?? normalizedPackageRoot ?? normalizedDocumentDir;
			}

			if (!documentInWorkspace && normalizedPackageRoot && !packageWithinWorkspace) {
				return normalizedPackageRoot;
			}

			const preferredPackageRoot =
				normalizedPackageRoot && (!normalizedWorkspaceFolder || packageWithinWorkspace)
					? normalizedPackageRoot
					: undefined;

			return preferredPackageRoot ?? normalizedWorkspaceFolder ?? normalizedDocumentDir;
		})();

		if (cwd) {
			const absoluteCwd = this.#path.isAbsolute(cwd) ? cwd : this.#path.resolve(cwd);

			options.cwd = this.#normalizeDriveCase(absoluteCwd);
		}

		return options;
	}

	// Workaround for Stylelint treating paths as case-sensitive on Windows
	// If the drive letter is lowercase, we need to convert it to uppercase
	// See https://github.com/stylelint/stylelint/issues/5594
	// TODO: Remove once fixed upstream
	#normalizeDriveCase(value: string): string {
		if (this.#path.sep !== '\\') {
			return value;
		}

		return value.replace(/^[a-z]:/, (match) => match.toUpperCase());
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
