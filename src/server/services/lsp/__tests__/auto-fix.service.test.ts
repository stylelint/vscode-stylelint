import { beforeEach, describe, expect, it } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Position, TextEdit } from 'vscode-languageserver-types';

import type { Connection } from 'vscode-languageserver';
import * as LSP from 'vscode-languageserver-protocol';
import { createTestLogger, type TestLogger } from '../../../../../test/helpers/index.js';
import {
	createDocumentFixesServiceStub,
	createLoggingServiceStub,
	createTextDocumentsStore,
	createWorkspaceOptionsStub,
	type DocumentFixesServiceStub,
	type TextDocumentsStore,
	type WorkspaceOptionsServiceStub,
} from '../../../../../test/helpers/stubs/index.js';
import { createContainer, module, provideTestValue } from '../../../../di/index.js';
import { lspConnectionToken, textDocumentsToken } from '../../../tokens.js';
import { CommandId } from '../../../types.js';
import { DocumentFixesService } from '../../documents/document-fixes.service.js';
import { type LoggingService, loggingServiceToken } from '../../infrastructure/logging.service.js';
import { WorkspaceOptionsService } from '../../workspace/workspace-options.service.js';
import { AutoFixService } from '../auto-fix.service.js';

type ApplyEditConnectionStub = {
	connection: Connection;
	applyEditCalls: LSP.WorkspaceEdit[];
	setApplyEditResponse(response: LSP.ApplyWorkspaceEditResult): void;
	setApplyEditError(error: unknown): void;
};

function createApplyEditConnectionStub(): ApplyEditConnectionStub {
	const applyEditCalls: LSP.WorkspaceEdit[] = [];
	let response: LSP.ApplyWorkspaceEditResult = { applied: true };
	let applyEditError: unknown;

	return {
		connection: {
			workspace: {
				applyEdit: async (edit: LSP.WorkspaceEdit) => {
					applyEditCalls.push(edit);

					if (applyEditError) {
						// Presuming to be an Error instance.
						// eslint-disable-next-line @typescript-eslint/only-throw-error
						throw applyEditError;
					}

					return response;
				},
			},
		} as unknown as Connection,
		applyEditCalls,
		setApplyEditResponse: (next: LSP.ApplyWorkspaceEditResult) => {
			response = next;
		},
		setApplyEditError: (error: unknown) => {
			applyEditError = error;
		},
	};
}

describe('AutoFixService', () => {
	let service: AutoFixService;
	let documents: TextDocumentsStore;
	let options: WorkspaceOptionsServiceStub;
	let fixes: DocumentFixesServiceStub;
	let connection: ApplyEditConnectionStub;
	let logger: TestLogger;
	let loggingService: LoggingService;

	beforeEach(() => {
		documents = createTextDocumentsStore();
		options = createWorkspaceOptionsStub();
		fixes = createDocumentFixesServiceStub();
		connection = createApplyEditConnectionStub();
		logger = createTestLogger();
		loggingService = createLoggingServiceStub(logger);

		const container = createContainer(
			module({
				register: [
					provideTestValue(textDocumentsToken, () => documents),
					provideTestValue(WorkspaceOptionsService, () => options),
					provideTestValue(DocumentFixesService, () => fixes),
					provideTestValue(lspConnectionToken, () => connection.connection),
					provideTestValue(loggingServiceToken, () => loggingService),
					AutoFixService,
				],
			}),
		);

		service = container.resolve(AutoFixService);
	});

	it('should be constructable', () => {
		expect(service).toBeInstanceOf(AutoFixService);
	});

	it('onInitialize should expose command capabilities', () => {
		expect(service.onInitialize?.()).toEqual({
			capabilities: {
				executeCommandProvider: {
					commands: [CommandId.ApplyAutoFix],
				},
			},
		});
	});

	it('should auto-fix documents', async () => {
		const document = TextDocument.create('foo', 'bar', 1, 'a {}');

		documents.set(document);
		options.setValidateLanguages(['bar']);
		fixes.setFixes(document.uri, [TextEdit.insert(Position.create(0, 0), 'text')]);

		await service.applyAutoFix({ uri: document.uri, version: document.version });

		expect(fixes.calls.map((call) => call.document)).toEqual([document]);
		expect(connection.applyEditCalls).toHaveLength(1);
		expect(connection.applyEditCalls[0]).toMatchSnapshot();
	});

	it('should not attempt to auto-fix when document is missing', async () => {
		await service.applyAutoFix({ uri: 'foo', version: 1 });

		expect(fixes.calls).toHaveLength(0);
		expect(connection.applyEditCalls).toHaveLength(0);
		expect(logger.debug).toHaveBeenLastCalledWith('Unknown document, ignoring', {
			uri: 'foo',
		});
	});

	it('should not auto-fix when document language is not enabled', async () => {
		const document = TextDocument.create('foo', 'bar', 1, 'a {}');

		documents.set(document);
		options.setValidateLanguages(['baz']);

		await service.applyAutoFix({ uri: document.uri, version: document.version });

		expect(fixes.calls).toHaveLength(0);
		expect(connection.applyEditCalls).toHaveLength(0);
		expect(logger.debug).toHaveBeenLastCalledWith('Document should not be auto-fixed, ignoring', {
			uri: document.uri,
			language: 'bar',
		});
	});

	it('should not auto-fix when document version has changed', async () => {
		const document = TextDocument.create('foo', 'bar', 2, 'a {}');

		documents.set(document);
		options.setValidateLanguages(['bar']);

		await service.applyAutoFix({ uri: document.uri, version: 1 });

		expect(fixes.calls).toHaveLength(0);
		expect(connection.applyEditCalls).toHaveLength(0);
		expect(logger.debug).toHaveBeenLastCalledWith('Document has been modified, ignoring', {
			uri: document.uri,
		});
	});

	it('should honour debug flag when skipping', async () => {
		const document = TextDocument.create('foo', 'bar', 1, 'a {}');

		documents.set(document);
		options.setValidateLanguages(['baz']);
		logger.setDebugEnabled(false);

		await service.applyAutoFix({ uri: document.uri, version: 1 });

		expect(logger.debug).not.toHaveBeenCalled();
	});

	it('logs when applying fixes fails to apply edits', async () => {
		const document = TextDocument.create('foo', 'bar', 1, 'a {}');

		documents.set(document);
		options.setValidateLanguages(['bar']);
		fixes.setFixes(document.uri, [TextEdit.insert(Position.create(0, 0), 'text')]);
		connection.setApplyEditResponse({ applied: false, failureReason: 'nope' });

		await service.applyAutoFix({ uri: document.uri, version: document.version });

		expect(logger.debug).toHaveBeenLastCalledWith('Failed to apply fixes', {
			uri: document.uri,
			response: { applied: false, failureReason: 'nope' },
		});
	});

	it('logs when applying fixes throws', async () => {
		const document = TextDocument.create('foo', 'bar', 1, 'a {}');

		documents.set(document);
		options.setValidateLanguages(['bar']);
		fixes.setFixes(document.uri, [TextEdit.insert(Position.create(0, 0), 'text')]);
		const error = new Error('boom');

		connection.setApplyEditError(error);

		await service.applyAutoFix({ uri: document.uri, version: document.version });

		expect(logger.debug).toHaveBeenLastCalledWith('Failed to apply fixes', {
			uri: document.uri,
			error,
		});
	});
});
