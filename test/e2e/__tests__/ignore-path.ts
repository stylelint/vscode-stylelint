import path from 'path';
import { normalizeDiagnostic } from '../utils';

describe('"stylelint.ignorePath" setting', () => {
	it('should be respected for files that are ignored', async () => {
		const { document } = await openDocument(path.resolve(workspaceDir, 'ignore-path/ignored.css'));
		const hasEmptyDiagnostics = await waitForEmptyDiagnostics(document);

		expect(hasEmptyDiagnostics).toBe(true);
	});

	it('should lint files that are not ignored', async () => {
		const { document } = await openDocument(
			path.resolve(workspaceDir, 'ignore-path/not-ignored.css'),
		);
		const diagnostics = await waitForDiagnostics(document);

		expect(diagnostics.map(normalizeDiagnostic)).toMatchSnapshot();
	});
});
