import { beforeEach, describe, expect, it } from 'vitest';
import * as LSP from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';

import {
	createLoggingServiceStub,
	createTestLogger,
	type TestLogger,
} from '../../../../../test/helpers/index.js';
import { createContainer, module, provideTestValue } from '../../../../di/index.js';
import type { LintDiagnostics } from '../../../stylelint/index.js';
import { type LoggingService, loggingServiceToken } from '../../infrastructure/logging.service.js';
import { DocumentDiagnosticsService } from '../document-diagnostics.service.js';

function createDocument(uri = 'file:///test.css'): TextDocument {
	return TextDocument.create(uri, 'css', 1, 'a {}');
}

describe('DocumentDiagnosticsService', () => {
	let service: DocumentDiagnosticsService;
	let logger: TestLogger;
	let loggingService: LoggingService;

	beforeEach(() => {
		logger = createTestLogger();
		loggingService = createLoggingServiceStub(logger);

		const container = createContainer(
			module({
				register: [
					provideTestValue(loggingServiceToken, () => loggingService),
					DocumentDiagnosticsService,
				],
			}),
		);

		service = container.resolve(DocumentDiagnosticsService);
	});

	it('set should cache diagnostics and lint result', () => {
		const document = createDocument();
		const diagnostics = [{ message: 'first' } as LSP.Diagnostic];
		const lintResult: LintDiagnostics = { diagnostics: [] };

		service.set(document, diagnostics, lintResult);

		expect(service.getDiagnostics(document.uri)).toEqual(diagnostics);
		expect(service.getLintResult(document.uri)).toEqual({
			...lintResult,
			version: document.version,
		});
		expect(logger.debug).toHaveBeenLastCalledWith('Updated diagnostics cache', {
			uri: document.uri,
			diagnostics: diagnostics.length,
			hasLintResult: true,
		});
	});

	it('set without lint result should clear previous lint cache entry', () => {
		const document = createDocument();
		const diagnostics = [{ message: 'a' } as LSP.Diagnostic];

		service.set(document, diagnostics, { diagnostics: [] });
		service.set(document, diagnostics);

		expect(service.getLintResult(document.uri)).toBeUndefined();
		expect(logger.debug).toHaveBeenLastCalledWith('Updated diagnostics cache', {
			uri: document.uri,
			diagnostics: diagnostics.length,
			hasLintResult: false,
		});
	});

	it('clear should remove cached diagnostics and lint results', () => {
		const document = createDocument();

		service.set(document, [{ message: 'first' } as LSP.Diagnostic], { diagnostics: [] });
		service.clear(document.uri);

		expect(service.getDiagnostics(document.uri)).toEqual([]);
		expect(service.getLintResult(document.uri)).toBeUndefined();
		expect(logger.debug).toHaveBeenLastCalledWith('Cleared diagnostics cache', {
			uri: document.uri,
		});
	});

	it('getDiagnostics should return empty array when not cached', () => {
		expect(service.getDiagnostics('file:///missing.css')).toEqual([]);
	});
});
