import { defaultLanguageServerOptions } from '../../../src/server/config/default-options.js';
import type { LanguageServerOptions } from '../../../src/server/types.js';
import type { WorkspaceOptionsService } from '../../../src/server/services/index.js';

export type WorkspaceOptionsServiceStub = Pick<WorkspaceOptionsService, 'getOptions'> & {
	setValidateLanguages(languages: string[]): void;
	setSnippetLanguages(languages: string[]): void;
	setDisableRuleCommentLocation(location: 'sameLine' | 'separateLine'): void;
	setOptions(uri: string, options: Partial<LanguageServerOptions>): void;
};

export function createWorkspaceOptionsStub(): WorkspaceOptionsServiceStub {
	let validate: string[] = [];
	let snippet: string[] = [];
	let disableRuleCommentLocation: 'sameLine' | 'separateLine' =
		defaultLanguageServerOptions.codeAction?.disableRuleComment.location ?? 'separateLine';
	const perUriOptions = new Map<string, Partial<LanguageServerOptions>>();

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
		setOptions: (uri: string, options: Partial<LanguageServerOptions>) => {
			perUriOptions.set(uri, options);
		},
		async getOptions(uri?: string) {
			const uriOptions = uri ? perUriOptions.get(uri) : undefined;

			if (uriOptions) {
				return {
					...defaultLanguageServerOptions,
					...uriOptions,
				};
			}

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
