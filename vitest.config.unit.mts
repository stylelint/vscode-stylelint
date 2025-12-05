import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		name: 'unit',
		environment: 'node',
		include: ['src/**/__tests__/**/*.ts'],
		exclude: ['test/e2e/**', 'test/integration/**'],
	},
});
