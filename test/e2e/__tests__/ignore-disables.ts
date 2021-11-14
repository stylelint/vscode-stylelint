import path from 'path';
import { normalizeDiagnostic } from '../utils';

describe('"stylelint.ignoreDisables" setting', () => {
	it('should ignore disable directives when enabled', async () => {
		const { document } = await openDocument(path.resolve(workspaceDir, 'ignore-disables/test.css'));
		const diagnostics = await waitForDiagnostics(document);

		expect(diagnostics.map(normalizeDiagnostic)).toMatchSnapshot();
	});
});
