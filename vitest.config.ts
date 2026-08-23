import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts', 'docker/**/*.test.ts'],
    environment: 'node',
  },
});
