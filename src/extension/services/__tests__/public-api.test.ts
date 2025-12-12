import { describe, expect, test } from 'vitest';

import { createPublicApi } from '../public-api.js';

describe('public API service', () => {
	test('exposes EventEmitter semantics with default flags', () => {
		const api = createPublicApi();
		let handled = 0;

		api.on('DidRegisterDocumentFormattingEditProvider', () => {
			handled += 1;
		});

		api.emit('DidRegisterDocumentFormattingEditProvider', {
			options: {
				documentSelector: [{ language: 'css' }],
			},
			uri: 'file:///test.css',
		});

		expect(api.codeActionReady).toBe(false);
		expect(handled).toBe(1);
	});
});
