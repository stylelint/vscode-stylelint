import { lint } from 'stylelint';
import { warningToDiagnostic } from '../warning-to-diagnostic';
import type stylelint from 'stylelint';

describe('warningToDiagnostic', () => {
	test('should convert a Stylelint warning to an LSP diagnostic', async () => {
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

		expect(warningToDiagnostic(warnings[0])).toMatchSnapshot();
		expect(warningToDiagnostic(warnings[1])).toMatchSnapshot();
	});

	test('should add a rule documentation URL if a matching rule exists', async () => {
		expect.assertions(1);
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
				},
			},
		});

		const rules = {
			'color-hex-case': { meta: { url: 'https://stylelint.io/rules/color-hex-case' } },
		} as unknown as {
			[name: string]: stylelint.Rule<unknown, unknown>;
		};

		expect(warningToDiagnostic(warnings[0], rules)).toMatchSnapshot();
	});
});
