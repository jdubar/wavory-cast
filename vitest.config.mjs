import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      // The page's own scripts; the tests run them in jsdom (test/harness.js), not as imports.
      include: ['lib.js', 'receiver.js'],
      reporter: ['text', 'lcov'],
    },
  },
});
