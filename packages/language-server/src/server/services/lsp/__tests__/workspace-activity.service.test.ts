import { describe, expect, test, vi } from 'vitest';

import { createContainer, module, provideTestValue } from '../../../../di/index.js';
import { NotificationService } from '../../infrastructure/notification.service.js';
import { StylelintRunnerService } from '../../stylelint-runtime/stylelint-runner.service.js';
import { WorkspaceActivityLspService } from '../workspace-activity.service.js';

describe('WorkspaceActivityLspService', () => {
	test('forwards file and document events to the runner', async () => {
		const runner = {
			handleDocumentOpened: vi.fn(),
			handleWatchedFilesChanged: vi.fn(),
		} as unknown as StylelintRunnerService;
		const notifications = {
			on: vi.fn(() => ({ dispose() {} })),
		} as unknown as NotificationService;
		const container = createContainer(
			module({
				register: [
					provideTestValue(StylelintRunnerService, () => runner),
					provideTestValue(NotificationService, () => notifications),
					WorkspaceActivityLspService,
				],
			}),
		);
		const service = container.resolve(WorkspaceActivityLspService);
		const document = { uri: 'file:///workspace/style.css' } as never;

		await service.handleDocumentOpened({ document } as never);
		service.handleWatchedFilesChanged({
			changes: [{ uri: 'file:///workspace/package.json', type: 1 }],
		});

		expect(runner.handleDocumentOpened).toHaveBeenCalledWith(document);
		expect(runner.handleWatchedFilesChanged).toHaveBeenCalledWith([
			{ uri: 'file:///workspace/package.json', type: 1 },
		]);
	});
});
