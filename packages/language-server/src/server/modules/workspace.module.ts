// @no-unit-test -- Module definition file that does not need unit tests.

import { module } from '../../di/index.js';
import { WorkspaceFolderService, WorkspaceOptionsService } from '../services/workspace/index.js';

export const workspaceModule = module({
	register: [WorkspaceFolderService, WorkspaceOptionsService],
});
