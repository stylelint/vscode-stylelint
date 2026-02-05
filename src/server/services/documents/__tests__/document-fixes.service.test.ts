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

	it('should resolve config and log success', async () => {
		const document = createDocument();
		const config: stylelint.Config = {
			customSyntax: 'postcss-scss',
			rules: { 'color-no-invalid-hex': true },
		};

		(
			runner as unknown as { resolveConfig: MockedFunction<() => Promise<stylelint.Config>> }
		).resolveConfig = vi.fn().mockResolvedValueOnce(config);

		const result = await service.resolveConfig(document);

		expect(options.getOptions).toHaveBeenCalledWith(document.uri);
		expect(result).toEqual(config);
		expect(logger.debug).toHaveBeenLastCalledWith('Config resolved', {
			uri: document.uri,
			hasConfig: true,
		});
	});

	it('should return undefined and log when config is not found', async () => {
		const document = createDocument();

		(
			runner as unknown as { resolveConfig: MockedFunction<() => Promise<undefined>> }
		).resolveConfig = vi.fn().mockResolvedValueOnce(undefined);

		const result = await service.resolveConfig(document);

		expect(result).toBeUndefined();
		expect(logger.debug).toHaveBeenLastCalledWith('Config resolved', {
			uri: document.uri,
			hasConfig: false,
		});
	});

	it('should swallow errors and log when resolveConfig throws', async () => {
		const document = createDocument();
		const error = new Error('config error');

		(runner as unknown as { resolveConfig: MockedFunction<() => Promise<never>> }).resolveConfig =
			vi.fn().mockRejectedValueOnce(error);

		const result = await service.resolveConfig(document);

		expect(result).toBeUndefined();
		expect(logger.error).toHaveBeenLastCalledWith('Error resolving config', {
			uri: document.uri,
			error,
		});
	});
});
