import path from 'path';
// import { normalizeDiagnostic, getStylelintDiagnostics } from '../utils';

describe('.stylelintignore', () => {
	it('should have syntax highlighting', async () => {
		const { document } = await openDocument(path.join(workspaceDir, 'defaults/.stylelintignore'));

		expect(document.languageId).toBe('ignore');
	});

	// TODO: Get .stylelintignore to work
	// eslint-disable-next-line jest/no-commented-out-tests
	// it('should be respected', async () => {
	// 	const { document } = await openDocument(path.resolve(workspaceDir, 'defaults/ignored.css'));

	// 	// Wait for diagnostics to be computed

	// 	expect(getStylelintDiagnostics(document.uri).map(normalizeDiagnostic)).toEqual([]);
	// });
});
