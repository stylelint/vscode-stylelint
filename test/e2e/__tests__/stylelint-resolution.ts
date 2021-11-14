import path from 'path';
import { normalizeDiagnostic } from '../utils';

describe('Stylelint resolution', () => {
	it('should resolve Stylelint using local node_modules', async () => {
		const { document } = await openDocument(
			path.resolve(workspaceDir, 'defaults/local-stylelint/test.css'),
		);
		const diagnostics = await waitForDiagnostics(document);

		expect(diagnostics.map(normalizeDiagnostic)).toMatchSnapshot();
	});

	it('should resolve Stylelint using "stylelint.stylelintPath"', async () => {
		const { document } = await openDocument(path.resolve(workspaceDir, 'stylelint-path/test.css'));
		const diagnostics = await waitForDiagnostics(document);

		expect(diagnostics.map(normalizeDiagnostic)).toMatchSnapshot();
	});

	it('should resolve Stylelint using PnP', async () => {
		const { document } = await openDocument(
			path.resolve(workspaceDir, 'defaults/yarn-pnp/test.css'),
		);
		const diagnostics = await waitForDiagnostics(document);

		expect(diagnostics.map(normalizeDiagnostic)).toMatchSnapshot();
	});

	it('should resolve Stylelint using Yarn 2.x PnP', async () => {
		const { document } = await openDocument(
			path.resolve(workspaceDir, 'defaults/yarn-2-pnp/test.css'),
		);
		const diagnostics = await waitForDiagnostics(document);

		expect(diagnostics.map(normalizeDiagnostic)).toMatchSnapshot();
	});
});
