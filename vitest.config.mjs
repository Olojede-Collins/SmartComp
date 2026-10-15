import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.{mjs,tsx}'],
    environment: 'node',
    globals: true,
  },
});
