import { CodeAction } from 'vscode-languageserver-types';
import { describe, expect, it } from 'vitest';
import { RuleCodeActionsCollection } from '../index.js';

describe('RuleCodeActionsCollection', () => {
	it('should be constructable', () => {
		const collection = new RuleCodeActionsCollection();

		expect(collection).toBeDefined();
	});

	it('should add code actions', () => {
		const disableLine = CodeAction.create('disableLine', 'kind');
		const disableFile = CodeAction.create('disableFile', 'kind');
		const documentation = CodeAction.create('documentation', 'kind');
		const collection = new RuleCodeActionsCollection();

		collection.get('rule').disableLine = disableLine;
		collection.get('rule').disableFile = disableFile;
		collection.get('rule').documentation = documentation;

		expect(collection.get('rule').disableLine).toBe(disableLine);
		expect(collection.get('rule').disableFile).toBe(disableFile);
		expect(collection.get('rule').documentation).toBe(documentation);
	});

	it('size should return the number of code actions', () => {
		const collection = new RuleCodeActionsCollection();

		collection.get('rule').disableLine = CodeAction.create('disableLine', 'kind');
		collection.get('rule').disableFile = CodeAction.create('disableFile', 'kind');
		collection.get('rule').documentation = CodeAction.create('documentation', 'kind');
		collection.get('rule 2').disableLine = CodeAction.create('disableLine', 'kind');
		collection.get('rule 3').disableFile = CodeAction.create('disableFile', 'kind');
		collection.get('rule 4').documentation = CodeAction.create('documentation', 'kind');

		expect(collection.size).toBe(6);
	});

	it('should iterate over the code actions in prioritized order', () => {
		const rule1DisableLine = CodeAction.create('disableLine', 'kind');
		const rule1DisableFile = CodeAction.create('disableFile', 'kind');
		const rule1Documentation = CodeAction.create('documentation', 'kind');
		const rule2DisableLine = CodeAction.create('disableLine', 'kind');
		const rule2Documentation = CodeAction.create('documentation', 'kind');
		const rule3DisableFile = CodeAction.create('disableFile', 'kind');
		const rule3Documentation = CodeAction.create('documentation', 'kind');

		const collection = new RuleCodeActionsCollection();

		collection.get('rule 1').disableLine = rule1DisableLine;
		collection.get('rule 1').disableFile = rule1DisableFile;
		collection.get('rule 1').documentation = rule1Documentation;
		collection.get('rule 2').disableLine = rule2DisableLine;
		collection.get('rule 2').documentation = rule2Documentation;
		collection.get('rule 3').disableFile = rule3DisableFile;
		collection.get('rule 3').documentation = rule3Documentation;

		const iterator = collection[Symbol.iterator]();

		expect(iterator.next().value).toBe(rule1DisableLine);
		expect(iterator.next().value).toBe(rule1DisableFile);
		expect(iterator.next().value).toBe(rule1Documentation);
		expect(iterator.next().value).toBe(rule2DisableLine);
		expect(iterator.next().value).toBe(rule2Documentation);
		expect(iterator.next().value).toBe(rule3DisableFile);
		expect(iterator.next().value).toBe(rule3Documentation);
		expect(iterator.next()).toStrictEqual({ done: true, value: undefined });
	});
});
