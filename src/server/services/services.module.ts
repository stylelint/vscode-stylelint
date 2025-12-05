// @no-unit-test -- No logic, just DI module definition.

import { module } from '../../di/module.js';
import { AutoFixService } from './lsp/auto-fix.service.js';
import { CodeActionService } from './lsp/code-actions/code-action.service.js';
import { CompletionService } from './lsp/completion.service.js';
import { FormatterLspService } from './lsp/formatter.service.js';
import { OldStylelintWarningLspService } from './lsp/old-stylelint-warning.service.js';
import { ValidatorLspService } from './lsp/validator.service.js';

export const languageServerServicesModule = module({
	register: [
		AutoFixService,
		CodeActionService,
		CompletionService,
		FormatterLspService,
		OldStylelintWarningLspService,
		ValidatorLspService,
	],
});
