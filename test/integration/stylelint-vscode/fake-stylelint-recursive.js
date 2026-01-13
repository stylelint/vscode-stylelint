'use strict';

const recursive = {};

recursive.self = recursive;

module.exports = {
	lint() {
		return {
			results: [
				{
					warnings: [
						{
							line: 1,
							column: 1,
							rule: 'fake-recursive',
							text: 'Recursive payload should not crash',
							severity: 'error',
						},
					],
					invalidOptionWarnings: [],
					// Intentional recursive shape that would fail JSON serialization if forwarded directly.
					recursive,
				},
			],
		};
	},
};
