import path from 'path';
import { normalizeDiagnostic } from '../utils';

describe('"stylelint.reportInvalidScopeDisables" setting', () => {
	it('should report invalid-scope disables when enabled', async () => {
		const { document } = await openDocument(
			path.resolve(workspaceDir, 'report-disables/invalid-scope.css'),
		);
		const diagnostics = await waitForDiagnostics(document);

		expect(
			diagnostics
				.map(normalizeDiagnostic)
				.filter((diagnostic) => diagnostic?.code === '--report-invalid-scope-disables'),
		).toMatchSnapshot();
	});
});
