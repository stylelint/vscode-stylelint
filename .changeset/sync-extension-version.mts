// Syncs the extension version and changelog between the proxy workspace
// package and the repository root, since Changesets can only version workspace
// member packages, not the root.
//
// Modes:
//   --seed: Copy root CHANGELOG.md to proxy before "changeset version".
//   --sync: Copy proxy CHANGELOG.md to root and sync version afterwards.

/* eslint-disable no-console */

import { copyFileSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = path.resolve(import.meta.dirname, '..');

const proxyPkgPath = path.join(rootDir, 'packages', 'vscode-stylelint', 'package.json');
const rootPkgPath = path.join(rootDir, 'package.json');

const proxyChangelogPath = path.join(rootDir, 'packages', 'vscode-stylelint', 'CHANGELOG.md');
const rootChangelogPath = path.join(rootDir, 'CHANGELOG.md');

const mode = process.argv[2];

if (mode === '--seed') {
	if (existsSync(rootChangelogPath)) {
		copyFileSync(rootChangelogPath, proxyChangelogPath);
		console.log('Seeded proxy CHANGELOG.md from root.');
	}
} else if (mode === '--sync') {
	// Sync version.
	const proxyPkg = JSON.parse(readFileSync(proxyPkgPath, 'utf-8'));
	const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf-8'));

	if (proxyPkg.version !== rootPkg.version) {
		rootPkg.version = proxyPkg.version;
		writeFileSync(rootPkgPath, `${JSON.stringify(rootPkg, null, 2)}\n`);
		console.log(`Synced root package.json version to ${proxyPkg.version}`);
	} else {
		console.log('Root package.json version already in sync.');
	}

	// Sync changelog.
	if (existsSync(proxyChangelogPath)) {
		copyFileSync(proxyChangelogPath, rootChangelogPath);
		console.log('Synced root CHANGELOG.md from proxy.');
	}
} else {
	console.error('Usage: sync-extension-version.mts [--seed | --sync]');
	process.exit(1);
}
