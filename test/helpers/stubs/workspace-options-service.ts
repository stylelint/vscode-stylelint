import { defaultLanguageServerOptions } from '../../../src/server/config/default-options.js';
import type { WorkspaceOptionsService } from '../../../src/server/services/index.js';

export type WorkspaceOptionsServiceStub = Pick<WorkspaceOptionsService, 'getOptions'> & {
	setValidateLanguages(languages: string[]): void;
	setSnippetLanguages(languages: string[]): void;
	setDisableRuleCommentLocation(location: 'sameLine' | 'separateLine'): void;
};

export function createWorkspaceOptionsStub(): WorkspaceOptionsServiceStub {
	let validate: string[] = [];
	let snippet: string[] = [];
	let disableRuleCommentLocation: 'sameLine' | 'separateLine' =
		defaultLanguageServerOptions.codeAction?.disableRuleComment.location ?? 'separateLine';

	return {
		setValidateLanguages: (languages: string[]) => {
			validate = languages;
		},
		setSnippetLanguages: (languages: string[]) => {
			snippet = languages;
		},
		setDisableRuleCommentLocation: (location: 'sameLine' | 'separateLine') => {
			disableRuleCommentLocation = location;
		},
		async getOptions() {
			return {
				...defaultLanguageServerOptions,
				validate,
				snippet,
				codeAction: {
					...defaultLanguageServerOptions.codeAction,
					disableRuleComment: {
						...defaultLanguageServerOptions.codeAction?.disableRuleComment,
						location: disableRuleCommentLocation,
					},
				},
			};
		},
	};
}
