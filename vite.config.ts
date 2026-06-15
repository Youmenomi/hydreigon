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
        format === 'es' ? 'hydreigon.js' : 'hydreigon.cjs',
      formats: ['es', 'cjs'],
    },
    sourcemap: true,
  },
  plugins: [
    dts({
      bundleTypes: true,
      entryRoot: 'src',
      tsconfigPath: './tsconfig.build.json',
    }),
  ],
  test: {
    globals: true,
    include: ['__test__/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
});
