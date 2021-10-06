'use strict';

const { lint } = /** @type {import('stylelint').StylelintPublicAPI} */ (require('stylelint'));

const fn = require('../../../src/warnings-to-diagnostics');

describe('stylelintWarningToVscodeDiagnostic()', () => {
	test('should convert a stylelint warning into a VS Code diagnostic and consider severity level', async () => {
		expect.assertions(2);
		const {
			results: [{ warnings }],
		} = await lint({
			code: `a {
				color: #AAA;
				border-color: #bbbbbb;
			}`,
			config: {
				rules: {
					'color-hex-case': ['lower'],
					'color-hex-length': ['short', { severity: 'warning' }],
				},
			},
		});

		expect(fn(warnings[0])).toMatchSnapshot();
		expect(fn(warnings[1])).toMatchSnapshot();
	});
});
