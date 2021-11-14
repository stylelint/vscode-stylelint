import type { CodeAction } from 'vscode-languageserver-protocol';
import type { RuleCodeActions } from './types';

/**
 * A collection of code actions that apply to specific rules. Allows adding
 * actions and retrieving them grouped by the rules to which they apply and
 * sorted by the priority of the rule.
 *
 * Actions are prioritized in the order:
 *
 * 1. Disable rule actions
 * 2. Show documentation actions
 */
export class RuleCodeActionsCollection implements Iterable<CodeAction> {
	/**
	 * The code actions, keyed by their rule.
	 */
	#actions = new Map<string, RuleCodeActions>();

	/**
	 * Gets the code actions for a rule.
	 */
	get(ruleId: string): RuleCodeActions {
		const existing = this.#actions.get(ruleId);

		if (existing) {
			return existing;
		}

		const actions: RuleCodeActions = {};

		this.#actions.set(ruleId, actions);

		return actions;
	}

	/**
	 * Iterates over the code actions, grouped by rule and sorted by the
	 * priority of the rule.
	 */
	*[Symbol.iterator](): IterableIterator<CodeAction> {
		for (const actions of this.#actions.values()) {
			if (actions.disableLine) {
				yield actions.disableLine;
			}

			if (actions.disableFile) {
				yield actions.disableFile;
			}

			if (actions.documentation) {
				yield actions.documentation;
			}
		}
	}

	/**
	 * Gets the number of code actions.
	 */
	get size(): number {
		const iterator = this[Symbol.iterator]();
		let size = 0;

		while (!iterator.next().done) {
			size++;
		}

		return size;
	}
}
