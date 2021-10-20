'use strict';

const {
	CompletionItem,
	CompletionItemKind,
	InsertTextFormat,
	MarkupKind,
} = require('vscode-languageserver-types');

/**
 * Creates a disable completion item for the given disable type. Uses the given rule if one is
 * provided, otherwise uses a placeholder.
 * @param {DisableType} disableType
 * @param {string} [rule]
 * @returns {CompletionItem}
 */
function createDisableCompletionItem(disableType, rule = '') {
	const item = CompletionItem.create(disableType);

	item.kind = CompletionItemKind.Snippet;
	item.insertTextFormat = InsertTextFormat.Snippet;

	if (disableType === 'stylelint-disable') {
		item.insertText = `/* stylelint-disable \${0:${rule || 'rule'}} */\n/* stylelint-enable \${0:${
			rule || 'rule'
		}} */`;
		item.detail =
			'Turn off all Stylelint or individual rules, after which you do not need to re-enable stylelint. (stylelint)';
		item.documentation = {
			kind: MarkupKind.Markdown,
			value: `\`\`\`css\n/* stylelint-disable ${rule || 'rule'} */\n/* stylelint-enable ${
				rule || 'rule'
			} */\n\`\`\``,
		};
	} else {
		item.insertText = `/* ${disableType} \${0:${rule || 'rule'}} */`;
		item.detail =
			disableType === 'stylelint-disable-line'
				? 'Turn off Stylelint rules for individual lines only, after which you do not need to explicitly re-enable them. (stylelint)'
				: 'Turn off Stylelint rules for the next line only, after which you do not need to explicitly re-enable them. (stylelint)';
		item.documentation = {
			kind: MarkupKind.Markdown,
			value: `\`\`\`css\n/* ${disableType} ${rule || 'rule'} */\n\`\`\``,
		};
	}

	return item;
}

module.exports = {
	createDisableCompletionItem,
};
