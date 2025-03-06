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
				color: #AA;
				border-color: #bbbbbb;
			}`,
			config: {
				rules: {
					'color-no-invalid-hex': true,
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
				color: #AA;
				border-color: #bbbbbb;
			}`,
			config: {
				rules: {
					'color-no-invalid-hex': true,
				},
			},
		});

		const rules = {
			'color-no-invalid-hex': {
				url: 'https://stylelint.io/rules/color-no-invalid-hex',
			},
		} as {
			[name: string]: Partial<stylelint.RuleMeta>;
		};

		expect(warningToDiagnostic(warnings[0], rules)).toMatchSnapshot();
	});
});
