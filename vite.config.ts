/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'hydreigon',
      fileName: (format) =>
        format === 'es'
          ? 'hydreigon.js'
          : format === 'cjs'
            ? 'hydreigon.cjs'
            : 'hydreigon.global.js',
      formats: ['es', 'cjs', 'iife'],
    },
    sourcemap: true,
  },
  plugins: [
    dts({
      bundleTypes: true,
      entryRoot: 'src',
      tsconfigPath: './tsconfig.build.json',
      exclude: ['**/*.test.ts'],
    }),
  ],
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts'],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
});
