import { execa } from 'execa';
import { readFile, writeFile } from 'node:fs/promises';
import { stderr, stdout, exit, argv } from 'node:process';
import packageConfig from '../package.json' with { type: 'json' };

function usage() {
	stderr.write(`Usage: npm run switch-stylelint [version] [-- OPTIONS]

Switches the installed Stylelint version used for testing. Does not modify
package.json or package-lock.json.

Arguments:
  version     The Stylelint version to switch to. Defaults to the same as
              specified in package.json.
              Supported versions: default, 17 (same as default), 16, 15, 14

Options:
  --show       Show the currently installed Stylelint version.
  --h, --help  Show this help message

Examples:
  npm run switch-stylelint            # Installs Stylelint from package.json
  npm run switch-stylelint 16         # Installs Stylelint 16
  npm run switch-stylelint -- --show  # Shows installed Stylelint version
`);
}

/** @typedef { 'default' | '17' | '16' | '15' | '14' } StylelintVersion */

/**
 * @param {unknown} version
 * @returns {version is StylelintVersion} Whether the provided version is valid.
 */
function isStylelintVersion(version) {
	return (
		version === 'default' ||
		version === '17' ||
		version === '16' ||
		version === '15' ||
		version === '14'
	);
}

const args = argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
	usage();
	exit(0);
}

if (args.includes('--show')) {
	stdout.write(
		`${await import('stylelint/package.json', { with: { type: 'json' } }).then((mod) => mod.default.version)}\n`,
	);
	exit(0);
}

const version = args[0] ?? 'default';

if (!isStylelintVersion(version)) {
	usage();
	exit(1);
}

// Type wizardry to require all map entries to have the same keys, so that no
// packages are forgotten in any version.

/**
 * @template U
 * @typedef {U extends U ? keyof U : never} UnionKeys
 */

/**
 * Helper function to help TypeScript infer the correct types for the map.
 * @template T
 * @param {T & Record<keyof T, Record<UnionKeys<T[keyof T]>, string>>} map
 * @returns {T}
 */
function createPackageMap(map) {
	return map;
}

const packageMap = createPackageMap({
	default: {
		stylelint: packageConfig.devDependencies.stylelint,
		'stylelint-scss': packageConfig.devDependencies['stylelint-scss'],
	},
	17: {
		stylelint: packageConfig.devDependencies.stylelint,
		'stylelint-scss': packageConfig.devDependencies['stylelint-scss'],
	},
	16: {
		stylelint: '^16',
		'stylelint-scss': '^6',
	},
	15: {
		stylelint: '^15',
		'stylelint-scss': '^5',
	},
	14: {
		stylelint: '^14',
		'stylelint-scss': '^4',
	},
});

const selectedPackages = packageMap[version];

stderr.write(`>>> Switching to stylelint version: ${version}\n`);

const packageArgs = Object.entries(selectedPackages).map(([pkg, ver]) => `${pkg}@${ver}`);

stderr.write(`>>> Installing packages: ${packageArgs.join(' ')}\n`);

const install = () =>
	execa('npm', ['install', '--force', '--no-save', ...packageArgs], { stdio: 'inherit' });

// Hack for now due to stylelint-scss 6.x not having a version range for
// Stylelint 17.x yet. Need to do this since for 17.x we need the overrides
// in package.json to avoid installing incompatible versions.
if (version !== 'default' && version !== '17') {
	const originalFile = await readFile('./package.json', { encoding: 'utf8' });

	const { overrides: _overrides, ...rest } = packageConfig;

	await writeFile('./package.json', JSON.stringify(rest, null, 2), { encoding: 'utf8' });

	await install().finally(async () => {
		await writeFile('./package.json', originalFile, { encoding: 'utf8' });
	});
} else {
	await install();
}

stderr.write('>>> Done.\n');
