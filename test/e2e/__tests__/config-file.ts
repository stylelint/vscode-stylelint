import path from 'path';
import { normalizeDiagnostic } from '../utils';

describe('"stylelint.configFile" setting', () => {
	it('should resolve the config file using the specified path', async () => {
		const { document } = await openDocument(path.resolve(workspaceDir, 'config/config-file.css'));
		const diagnostics = await waitForDiagnostics(document);

		expect(diagnostics.map(normalizeDiagnostic)).toMatchSnapshot();
	});
});
