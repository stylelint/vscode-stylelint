import path from 'path';
import { normalizeDiagnostic } from '../utils';

describe('"stylelint.configBasedir" setting', () => {
	it('should resolve referenced configs using the base directory', async () => {
		const { document } = await openDocument(
			path.resolve(workspaceDir, 'config/config-basedir.css'),
		);
		const diagnostics = await waitForDiagnostics(document);

		expect(diagnostics.map(normalizeDiagnostic)).toMatchSnapshot();
	});
});
