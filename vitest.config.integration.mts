import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		name: 'integration',
		environment: 'node',
		include: ['test/integration/**/*.ts'],
		exclude: ['test/e2e/**', 'test/integration/connection-manager.ts'],
	},
});
