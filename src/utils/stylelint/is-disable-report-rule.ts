import { DisableReportRuleNames } from './types';

/**
 * Returns whether or not the given rule is a disable report rule.
 * @param rule The rule to check.
 */
export function isDisableReportRule(rule: unknown): rule is DisableReportRuleNames {
	switch (rule as DisableReportRuleNames) {
		case DisableReportRuleNames.Descriptionless:
		case DisableReportRuleNames.Illegal:
		case DisableReportRuleNames.InvalidScope:
		case DisableReportRuleNames.Needless:
			return true;

		default:
			return false;
	}
}
