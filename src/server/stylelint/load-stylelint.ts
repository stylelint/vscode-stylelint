import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { PackageRootService } from '../services/stylelint-runtime/package-root.service.js';
import type { Stylelint } from './index.js';

export type StylelintModuleType = 'cjs' | 'esm';

export type LoadStylelintResult = {
	stylelint: Stylelint;
	moduleType: StylelintModuleType;
};

type DynamicImportFn = (specifier: string) => Promise<unknown>;

// eslint-disable-next-line @typescript-eslint/no-implied-eval -- Needed to access dynamic import from CommonJS modules.
const realDynamicImport: DynamicImportFn = new Function(
	'specifier',
	'"use strict"; return import(specifier);',
) as DynamicImportFn;

let dynamicImportImpl: DynamicImportFn = realDynamicImport;

const getModulePath = (
	specifier: string,
	requireFn: NodeJS.Require,
): { modulePath: string; isResolved: boolean } => {
	if (specifier.startsWith('file://')) {
		return { modulePath: specifier, isResolved: true };
	}

	try {
		return { modulePath: requireFn.resolve(specifier), isResolved: true };
	} catch {
		return { modulePath: specifier, isResolved: false };
	}
};

const isPathSpecifier = (value: string): boolean =>
	value.startsWith('file://') ||
	path.isAbsolute(value) ||
	value.startsWith('./') ||
	value.startsWith('../');

const toFsPath = (target: string): string =>
	target.startsWith('file://') ? fileURLToPath(target) : target;

const normalizePackageTarget = (packageRoot: string, target: string): string => {
	if (target.startsWith('file://')) {
		return target;
	}

	if (path.isAbsolute(target)) {
		return target;
	}

	return path.join(packageRoot, target);
};

const resolveExportTarget = (value: unknown): string | undefined => {
	if (typeof value === 'string') {
		return value;
	}

	if (Array.isArray(value)) {
		for (const entry of value) {
			const resolved = resolveExportTarget(entry);

			if (resolved) {
				return resolved;
			}
		}

		return undefined;
	}

	if (value && typeof value === 'object') {
		const record = value as Record<string, unknown>;
		const priorityKeys = ['import', 'module', 'default'];

		for (const key of priorityKeys) {
			if (!(key in record)) {
				continue;
			}

			const resolved = resolveExportTarget(record[key]);

			if (resolved) {
				return resolved;
			}
		}

		for (const [key, child] of Object.entries(record)) {
			if (priorityKeys.includes(key) || key === 'require' || key === 'types') {
				continue;
			}

			const resolved = resolveExportTarget(child);

			if (resolved) {
				return resolved;
			}
		}
	}

	return undefined;
};

const resolvePreferredEsmEntry = async (
	modulePath: string,
	packageRootFinder: PackageRootService,
): Promise<string | undefined> => {
	const packageRoot = await packageRootFinder.find(path.resolve(toFsPath(modulePath)));

	if (!packageRoot) {
		return undefined;
	}

	try {
		const manifestPath = path.join(packageRoot, 'package.json');
		const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as {
			exports?: unknown;
			module?: string;
		};
		const rootExport =
			typeof manifest.exports === 'object' && !Array.isArray(manifest.exports)
				? ((manifest.exports as Record<string, unknown>)['.'] ?? manifest.exports)
				: manifest.exports;
		const exportTarget = resolveExportTarget(rootExport);

		if (exportTarget) {
			return normalizePackageTarget(packageRoot, exportTarget);
		}

		if (typeof manifest.module === 'string') {
			return normalizePackageTarget(packageRoot, manifest.module);
		}
	} catch {
		return undefined;
	}

	return undefined;
};

const loadESMStylelint = async (
	target: string,
	treatAsPath = true,
): Promise<LoadStylelintResult> => {
	const specifier =
		treatAsPath && !target.startsWith('file://')
			? pathToFileURL(path.resolve(target)).href
			: target;
	const namespace = (await dynamicImportImpl(specifier)) as { default?: Stylelint } | Stylelint;
	const stylelint = (namespace as { default?: Stylelint }).default ?? (namespace as Stylelint);

	if (!stylelint) {
		throw new Error(`Failed to import Stylelint from ${target}.`);
	}

	return { stylelint, moduleType: 'esm' };
};

/**
 * Loads the Stylelint module, supporting both CommonJS and ESM builds.
 * @param specifier Path or specifier that can be resolved by the provided require function.
 * @param requireFn Custom require implementation, defaults to the global require.
 * @param resolvedPath Optional pre-resolved module path used when falling back to ESM imports.
 */
export const loadStylelint = async (
	packageRootFinder: PackageRootService,
	specifier: string,
	requireFn: NodeJS.Require,
	resolvedPath: string,
): Promise<LoadStylelintResult> => {
	const { modulePath, isResolved } = resolvedPath
		? { modulePath: resolvedPath, isResolved: true }
		: getModulePath(specifier, requireFn);
	const hasResolvedPath = isResolved || isPathSpecifier(modulePath);
	const preferredEsmEntry = hasResolvedPath
		? await resolvePreferredEsmEntry(modulePath, packageRootFinder)
		: undefined;
	const seenTargets = new Set<string>();
	const importTargets: Array<{ target: string; treatAsPath: boolean }> = [];
	const addImportTarget = (target: string | undefined, treatAsPath: boolean): void => {
		if (!target) {
			return;
		}

		const key = `${treatAsPath ? 'path' : 'spec'}:${target}`;

		if (seenTargets.has(key)) {
			return;
		}

		seenTargets.add(key);
		importTargets.push({ target, treatAsPath });
	};

	addImportTarget(preferredEsmEntry, true);

	if (isPathSpecifier(specifier)) {
		addImportTarget(specifier, true);
	}

	const resolvedImportTarget = resolvedPath ?? (hasResolvedPath ? modulePath : undefined);

	addImportTarget(resolvedImportTarget, true);

	let firstImportError: unknown;

	for (const { target, treatAsPath } of importTargets) {
		try {
			return await loadESMStylelint(target, treatAsPath);
		} catch (error) {
			if (!firstImportError) {
				firstImportError = error;
			}
		}
	}

	try {
		return {
			stylelint: requireFn(specifier) as Stylelint,
			moduleType: 'cjs',
		};
	} catch (requireError) {
		if (firstImportError) {
			// eslint-disable-next-line @typescript-eslint/only-throw-error
			throw firstImportError;
		}

		throw requireError;
	}
};

/**
 * Internal hooks used by the unit tests to control the dynamic import helper.
 */
export const __loadStylelintTestApi = {
	setDynamicImport(mock: DynamicImportFn): void {
		dynamicImportImpl = mock;
	},
	resetDynamicImport(): void {
		dynamicImportImpl = realDynamicImport;
	},
};
