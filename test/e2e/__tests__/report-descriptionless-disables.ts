import path from 'path';
import { normalizeDiagnostic } from '../utils';

describe('"stylelint.reportDescriptionlessDisables" setting', () => {
	it('should report invalid-scope disables when enabled', async () => {
		const { document } = await openDocument(
			path.resolve(workspaceDir, 'descriptionless-disables/test.css'),
		);
		const diagnostics = await waitForDiagnostics(document);

		expect(
			diagnostics
				.map(normalizeDiagnostic)
				.filter((diagnostic) => diagnostic?.code === '--report-descriptionless-disables'),
		).toMatchSnapshot();
	});
});
