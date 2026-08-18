// @ts-check

// Based on https://github.com/changesets/changesets/blob/main/packages/changelog-github/src/index.ts

import { getCommitInfo, getPullRequestInfo } from '@changesets/get-github-info';

/**
 * @type {import('@changesets/types').ChangelogFunctions}
 */
const changelogFunctions = {
	async getReleaseLine(changeset, _type, options) {
		if (!options || typeof options.repo !== 'string' || !options.repo) {
			throw new Error(
				'Please provide a repo to this changelog generator like this:\n"changelog": ["@changesets/changelog-github", { "repo": "org/repo" }]',
			);
		}

		const { repo } = options;

		/** @type {number | undefined} */
		let prFromSummary;

		/** @type {string | undefined} */
		let commitFromSummary;

		/** @type {string[]} */
		const usersFromSummary = [];

		const replacedChangelog = changeset.summary
			.replace(/^\s*(?:pr|pull|pull\s+request):\s*#?(\d+)/im, (_, pr) => {
				const num = Number(pr);

				if (!isNaN(num)) prFromSummary = num;

				return '';
			})
			.replace(/^\s*commit:\s*(\S+)/im, (_, commit) => {
				commitFromSummary = commit;

				return '';
			})
			.replace(/^\s*(?:author|user):\s*@?(\S+)/gim, (_, user) => {
				usersFromSummary.push(user);

				return '';
			})
			.trim();

		const [firstLine, ...futureLines] = replacedChangelog.split('\n').map((l) => l.trimEnd());

		const info = await (async () => {
			if (prFromSummary !== undefined) {
				return getPullRequestInfo({
					repo,
					pull: prFromSummary,
				});
			}

			const commitToFetchFrom = commitFromSummary || changeset.commit;

			if (commitToFetchFrom) {
				return getCommitInfo({
					repo,
					commit: commitToFetchFrom,
				});
			}

			return undefined;
		})();

		const links = {
			pull: info?.pull?.markdownLink ?? null,
			user: info?.author?.markdownLink ?? null,
		};

		const users = usersFromSummary.length
			? usersFromSummary
					.map((userFromSummary) => `[@${userFromSummary}](https://github.com/${userFromSummary})`)
					.join(', ')
			: links.user;

		const suffix = [
			links.pull === null ? '' : ` (${links.pull})`,
			users === null ? '' : ` (${users})`,
		].join('');

		const line = `${firstLine}${futureLines.map((l) => `  ${l}`).join('\n')}${suffix}`;

		return line ? `- ${line}.` : '';
	},
	async getDependencyReleaseLine() {
		return '';
	},
};

export default changelogFunctions;
