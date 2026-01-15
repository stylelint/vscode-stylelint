import { execa } from 'execa';
import { stderr, stdout, exit, argv } from 'node:process';
import { satisfies, validRange } from 'semver';
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

/**
 * @typedef {Object} InstalledPackage
 * @property {string} [version]
 * @property {string} [resolved]
 * @property {string} [from]
 */

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

const gitSpecPattern = /^(?:git\+)?(?:https?|ssh):\/\/|^(?:git|github):|\.git(?:#|$)/i;

/**
 * @param {string} spec
 * @returns {{ url: string, ref: string | null }}
 */
const parseGitSpec = (spec) => {
	const cleaned = spec.replace(/^git\+/, '');
	const [base, ref = null] = cleaned.split('#', 2);

	if (base.startsWith('github:')) {
		const path = base.replace(/^github:/, '');

		return { url: `https://github.com/${path}.git`, ref };
	}

	if (base.startsWith('git@github.com:') || base.startsWith('ssh://git@github.com/')) {
		const normalized = base.replace(/^ssh:\/\/git@github\.com\//i, 'git@github.com:');

		return { url: normalized.endsWith('.git') ? normalized : `${normalized}.git`, ref };
	}

	if (base.startsWith('https://') || base.startsWith('ssh://')) {
		return { url: base.endsWith('.git') ? base : `${base}.git`, ref };
	}

	return { url: base.endsWith('.git') ? base : `${base}.git`, ref };
};

/** @param {string} spec */
const normalizeGitSpec = (spec) => {
	const [rawBase, ref] = spec.replace(/^git\+/, '').split('#', 2);
	const base = rawBase
		.replace(/^git@github\.com:/i, 'github.com/')
		.replace(/^ssh:\/\/git@github\.com\//i, 'github.com/')
		.replace(/^https:\/\/github\.com\//i, 'github.com/')
		.replace(/\.git$/i, '')
		.toLowerCase();
	return `${base}${ref ? `#${ref}` : ''}`;
};

/** @param {string} spec */
const isGitSpec = (spec) => gitSpecPattern.test(spec);

/**
 * @param {string} pkg
 * @returns {Promise<InstalledPackage | null>}
 */
const readInstalled = async (pkg) => {
	try {
		const result = await execa('npm', ['list', pkg, '--depth=0', '--json'], {
			stderr: 'pipe',
			stdout: 'pipe',
		});
		const parsed = JSON.parse(result.stdout);

		return parsed.dependencies?.[pkg] ?? null;
	} catch (error) {
		if (
			typeof error === 'object' &&
			error !== null &&
			'stdout' in error &&
			typeof error.stdout === 'string'
		) {
			try {
				const parsed = JSON.parse(error.stdout);
				return parsed.dependencies?.[pkg] ?? null;
			} catch {
				// Ignore, fall through to throwing the original error.
			}
		}

		if (typeof error === 'object' && error !== null && 'exitCode' in error) {
			return null;
		}

		throw error;
	}
};

/**
 * @param {string} spec
 * @returns {Promise<string | null>}
 */
const resolveGitSha = async (spec) => {
	const { url, ref } = parseGitSpec(spec);
	const targetRef = ref ?? 'HEAD';

	try {
		const { stdout: refs } = await execa('git', ['ls-remote', url, targetRef], {
			stderr: 'pipe',
		});
		const line = refs.split('\n').find((entry) => entry.trim().length > 0);
		const sha = line?.split(/\s+/)[0];

		return sha ?? null;
	} catch {
		return null;
	}
};

/** @param {string | undefined} value */
const extractGitSha = (value) => {
	if (!value) {
		return null;
	}

	const idx = value.lastIndexOf('#');

	if (idx === -1 || idx === value.length - 1) {
		return null;
	}

	const sha = value.slice(idx + 1).trim();

	return sha && /^[a-f0-9]{7,40}$/i.test(sha) ? sha.toLowerCase() : null;
};

/**
 * @param {string} desiredSpec
 * @param {InstalledPackage | null} installed
 * @param {string | null} desiredGitSha
 */
const matchesSpec = (desiredSpec, installed, desiredGitSha = null) => {
	if (!installed) {
		return false;
	}

	if (isGitSpec(desiredSpec)) {
		const desired = normalizeGitSpec(desiredSpec);
		const from = installed.from ? normalizeGitSpec(installed.from) : null;
		const resolved = installed.resolved ? normalizeGitSpec(installed.resolved) : null;
		const installedSha = extractGitSha(installed.resolved ?? installed.from);

		if (desiredGitSha && installedSha) {
			return desiredGitSha.toLowerCase() === installedSha.toLowerCase();
		}

		return desired === from || desired === resolved;
	}

	const range = validRange(desiredSpec);

	if (!range) {
		return installed.version === desiredSpec;
	}

	return installed.version
		? satisfies(installed.version, range, { includePrerelease: true })
		: false;
};

/** @param {InstalledPackage | null} installed */
const describeInstalled = (installed) => {
	if (!installed) {
		return 'not installed';
	}

	if (installed.from && isGitSpec(installed.from)) {
		return installed.from;
	}

	if (installed.resolved && isGitSpec(installed.resolved)) {
		return installed.resolved;
	}

	return installed.version ?? 'unknown version';
};

/** @type {Array<[string, string, string | null, InstalledPackage | null]>} */
const installedPackages = await Promise.all(
	Object.entries(selectedPackages).map(async ([pkg, spec]) => [
		pkg,
		spec,
		await resolveGitSha(spec),
		await readInstalled(pkg),
	]),
);

const allMatch = installedPackages.every(([, spec, desiredGitSha, meta]) =>
	matchesSpec(spec, meta, desiredGitSha),
);

if (allMatch) {
	stderr.write('>>> Packages already match requested versions. Skipping install.\n');
	exit(0);
}

installedPackages
	.filter(([, spec, desiredGitSha, meta]) => !matchesSpec(spec, meta, desiredGitSha))
	.forEach(([pkg, spec, _desiredGitSha, meta]) => {
		stderr.write(`>>> ${pkg}: desired ${spec}, currently ${describeInstalled(meta)}\n`);
	});

await install();

stderr.write('>>> Done.\n');
