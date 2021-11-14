import path from 'path';
import { normalizeDiagnostic } from '../utils';

describe('Linting', () => {
	it('should lint CSS documents', async () => {
		const { document } = await openDocument(path.resolve(workspaceDir, 'defaults/lint.css'));
		const diagnostics = await waitForDiagnostics(document);

		expect(diagnostics.map(normalizeDiagnostic)).toMatchSnapshot();
	});

	it('should display rule documentation links when one is available', async () => {
		const { document } = await openDocument(path.resolve(workspaceDir, 'defaults/rule-doc.css'));
		const diagnostics = await waitForDiagnostics(document);

		expect(diagnostics.map(normalizeDiagnostic)).toMatchSnapshot();
	});
});
