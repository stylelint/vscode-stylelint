import path from 'path';

describe('.stylelintignore', () => {
	it('should have syntax highlighting', async () => {
		const { document } = await openDocument(path.join(workspaceDir, 'defaults/.stylelintignore'));

		expect(document.languageId).toBe('ignore');
	});

	it('should be respected', async () => {
		const { document } = await openDocument(path.resolve(workspaceDir, 'defaults/ignored.css'));
		const hasEmptyDiagnostics = await waitForEmptyDiagnostics(document);

		expect(hasEmptyDiagnostics).toBe(true);
	});
});
