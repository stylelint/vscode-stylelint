import path from 'path';
import { languages, Diagnostic, TextDocument } from 'vscode';
import { normalizeDiagnostic } from '../utils';

describe('"stylelint.ignorePath" setting', () => {
	it('should be respected for files that are ignored', async () => {
		const { document } = await openDocument(path.resolve(workspaceDir, 'ignore-path/ignored.css'));

		// If a file is ignored, diagnostics are returned as an empty object ([]), which never
		// resolves with the current implementation of `waitForDiagnostics`. This promise uses
		// a listener to resolve with the empty diagnostics when they are available.
		const waitForEmptyDiagnostics = (document: TextDocument) =>
			new Promise<Diagnostic[]>((resolve) => {
				const onDidChangeDiagnostics = languages.onDidChangeDiagnostics(
					(diagnosticsChangeEvent) => {
						if (
							diagnosticsChangeEvent.uris.filter((uri) => uri.path === document.uri.path).length > 0
						) {
							resolve(languages.getDiagnostics(document.uri));
							onDidChangeDiagnostics.dispose();
						}
					},
				);
			});

		const diagnostics = await waitForEmptyDiagnostics(document);
		expect(diagnostics).toEqual([]);
	});

	it('should lint files that are not ignored', async () => {
		const { document } = await openDocument(
			path.resolve(workspaceDir, 'ignore-path/not-ignored.css'),
		);
		const diagnostics = await waitForDiagnostics(document);

		expect(diagnostics.map(normalizeDiagnostic)).toMatchSnapshot();
	});
});
