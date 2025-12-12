import path from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';

import type { PackageRootService } from '../../services/stylelint-runtime/package-root.service.js';
import { __loadStylelintTestApi, loadStylelint, LoadStylelintResult } from '../load-stylelint.js';

function createPackageRootFinder(root?: string): PackageRootService {
	return {
		find: vi.fn(async () => root),
	} as unknown as PackageRootService;
}

function callLoadStylelint(
	packageRootFinder: PackageRootService,
	specifier: string,
	requireFn: NodeJS.Require,
	resolvedPath: string,
): Promise<LoadStylelintResult> {
	return loadStylelint(packageRootFinder, specifier, requireFn, resolvedPath);
}

describe('loadStylelint', () => {
	const fixturesDir = path.join(__dirname, 'fixtures');

	afterEach(() => {
		__loadStylelintTestApi.resetDynamicImport();
	});

	test('prefers ESM modules when available', async () => {
		const modulePath = path.join(fixturesDir, 'stylelint-esm.mjs');
		const importer = vi.fn(async () => ({
			default: { lint: () => 'esm-fixture' },
		}));
		const packageRootFinder = createPackageRootFinder();

		__loadStylelintTestApi.setDynamicImport(importer);

		const requireFn = Object.assign(
			vi.fn(() => {
				throw new Error('require should not be called');
			}),
			{
				resolve: () => modulePath,
			},
		) as unknown as NodeJS.Require;

		const { stylelint, moduleType } = await callLoadStylelint(
			packageRootFinder,
			modulePath,
			requireFn,
			modulePath,
		);

		expect(importer).toHaveBeenCalledWith(expect.stringContaining('stylelint-esm.mjs'));
		expect(requireFn).not.toHaveBeenCalled();
		expect(moduleType).toBe('esm');
		expect(stylelint.lint({})).toBe('esm-fixture');
	});

	test('prioritizes ESM entry defined via package exports', async () => {
		const packageRoot = path.join(fixturesDir, 'prefer-esm');
		const cjsEntry = path.join(packageRoot, 'index.cjs');
		const importer = vi.fn(async () => ({
			default: { lint: () => 'esm-fixture' },
		}));
		const packageRootFinder = createPackageRootFinder(packageRoot);

		__loadStylelintTestApi.setDynamicImport(importer);

		const requireFn = Object.assign(
			vi.fn(() => ({ lint: () => 'cjs-fixture' })),
			{
				resolve: vi.fn(() => cjsEntry),
			},
		) as unknown as NodeJS.Require;

		const { stylelint, moduleType } = await callLoadStylelint(
			packageRootFinder,
			'stylelint-prefer-esm',
			requireFn,
			cjsEntry,
		);

		expect(importer).toHaveBeenCalledWith(expect.stringContaining('index.mjs'));
		expect(requireFn).not.toHaveBeenCalled();
		expect(moduleType).toBe('esm');
		expect(stylelint.lint({})).toBe('esm-fixture');
	});

	test('falls back to CommonJS require when ESM import fails', async () => {
		const modulePath = path.join(fixturesDir, 'stylelint.cjs.cjs');
		const importer = vi.fn(async () => {
			throw new Error('Cannot import module');
		});
		const packageRootFinder = createPackageRootFinder();

		__loadStylelintTestApi.setDynamicImport(importer);

		const requireFn = Object.assign(
			vi.fn(() => ({ lint: () => 'cjs-fixture' })),
			{
				resolve: () => modulePath,
			},
		) as unknown as NodeJS.Require;

		const { stylelint, moduleType } = await callLoadStylelint(
			packageRootFinder,
			modulePath,
			requireFn,
			modulePath,
		);

		expect(importer).toHaveBeenCalledWith(expect.stringContaining('stylelint.cjs.cjs'));
		expect(requireFn).toHaveBeenCalledTimes(1);
		expect(moduleType).toBe('cjs');
		expect(stylelint.lint({})).toBe('cjs-fixture');
	});

	test('rethrows the ESM import error when fallback loading fails', async () => {
		const modulePath = path.join(fixturesDir, 'stylelint-esm.mjs');
		const importError = new Error('Dynamic import failed');
		const importer = vi.fn(async () => {
			throw importError;
		});
		const packageRootFinder = createPackageRootFinder();

		__loadStylelintTestApi.setDynamicImport(importer);

		const requireFn = Object.assign(
			vi.fn(() => {
				throw new Error('Cannot require module');
			}),
			{
				resolve: () => modulePath,
			},
		) as unknown as NodeJS.Require;

		await expect(
			callLoadStylelint(packageRootFinder, modulePath, requireFn, modulePath),
		).rejects.toBe(importError);
		expect(requireFn).toHaveBeenCalledTimes(1);
	});
});
