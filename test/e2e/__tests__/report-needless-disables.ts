import path from 'path';
import { normalizeDiagnostic } from '../utils';

describe('"stylelint.reportNeedlessDisables" setting', () => {
	it('should report needless disables when enabled', async () => {
		const { document } = await openDocument(
			path.resolve(workspaceDir, 'report-disables/needless.css'),
		);
		const diagnostics = await waitForDiagnostics(document);

		expect(
			diagnostics
				.map(normalizeDiagnostic)
				.filter((diagnostic) => diagnostic?.code === '--report-needless-disables'),
		).toMatchSnapshot();
	});
});
