// @no-unit-test -- Module definition file that does not need unit tests.

import { module } from '../../di/index.js';
import {
	AutoFixService,
	CodeActionService,
	DisableRuleFileCodeActionService,
	DisableRuleLineCodeActionService,
	CompletionService,
	EmptyConfigWarningLspService,
	FormatterLspService,
	OldStylelintWarningLspService,
	ValidatorLspService,
	WorkspaceActivityLspService,
} from '../services/lsp/index.js';

export const lspModule = module({
	register: [
		DisableRuleLineCodeActionService,
		DisableRuleFileCodeActionService,
		AutoFixService,
		CodeActionService,
		CompletionService,
		EmptyConfigWarningLspService,
		FormatterLspService,
		OldStylelintWarningLspService,
		ValidatorLspService,
		WorkspaceActivityLspService,
	],
});
