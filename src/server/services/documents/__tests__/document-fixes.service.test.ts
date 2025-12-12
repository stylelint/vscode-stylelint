import type stylelint from 'stylelint';
import { beforeEach, describe, expect, it, vi, type MockedFunction } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { TextEdit } from 'vscode-languageserver-types';

import {
	createLoggingServiceStub,
	createTestLogger,
	type TestLogger,
} from '../../../../../test/helpers/index.js';
import { createContainer, module, provideTestValue } from '../../../../di/index.js';
import { loggingServiceToken, type LoggingService } from '../../infrastructure/logging.service.js';
import { StylelintRunnerService } from '../../stylelint-runtime/stylelint-runner.service.js';
import { WorkspaceOptionsService } from '../../workspace/workspace-options.service.js';
import { DocumentFixesService, getFixesFnToken } from '../document-fixes.service.js';

type GetFixesFn = (typeof import('../../../utils/documents/get-fixes.js'))['getFixes'];

function createDocument(uri = 'file:///test.css'): TextDocument {
	return TextDocument.create(uri, 'css', 1, 'a {}');
}

describe('DocumentFixesService', () => {
	let service: DocumentFixesService;
	let runner: StylelintRunnerService;
	let options: WorkspaceOptionsService;
	let logger: TestLogger;
	let getFixesFn: MockedFunction<GetFixesFn>;
	let loggingService: LoggingService;

	beforeEach(() => {
		vi.clearAllMocks();

		runner = { token: 'runner' } as unknown as StylelintRunnerService;
		options = {
			getOptions: vi.fn().mockResolvedValue({ use: 'defaults' }),
		} as unknown as WorkspaceOptionsService;
		logger = createTestLogger();
		getFixesFn = vi.fn<GetFixesFn>() as MockedFunction<GetFixesFn>;
		loggingService = createLoggingServiceStub(logger);

		const container = createContainer(
			module({
				register: [
					provideTestValue(loggingServiceToken, () => loggingService),
					provideTestValue(getFixesFnToken, () => getFixesFn),
					provideTestValue(StylelintRunnerService, () => runner),
					provideTestValue(WorkspaceOptionsService, () => options),
					DocumentFixesService,
				],
			}),
		);

		service = container.resolve(DocumentFixesService);
	});

	it('should request options, invoke getFixes and log success', async () => {
		const document = createDocument();
		const edits: TextEdit[] = [
			{
				range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
				newText: 'body {}',
			},
		];

		getFixesFn.mockResolvedValueOnce(edits);

		const result = await service.getFixes(document, { rules: {} } as stylelint.LinterOptions);

		expect(options.getOptions).toHaveBeenCalledWith(document.uri);
		expect(getFixesFn).toHaveBeenCalledWith(runner, document, { rules: {} }, { use: 'defaults' });
		expect(result).toEqual(edits);
		expect(logger.debug).toHaveBeenLastCalledWith('Fixes retrieved', {
			uri: document.uri,
			edits,
		});
	});

	it('should swallow errors and log when getFixes throws', async () => {
		const document = createDocument();
		const error = new Error('boom');

		getFixesFn.mockRejectedValueOnce(error);

		const result = await service.getFixes(document);

		expect(result).toEqual([]);
		expect(logger.error).toHaveBeenLastCalledWith('Error getting fixes', {
			uri: document.uri,
			error,
		});
	});
});
