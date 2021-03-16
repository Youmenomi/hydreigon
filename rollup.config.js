//@ts-check

import { build } from 'rollup-simple-configer'
import pkg from './package.json'

const input = './src/index.ts'

export default [].concat(
  build(
    input,
    {
      file: pkg.main,
      format: 'cjs',
    },
    { external: ['auto-bind'] }
  ),
  build(
    input,
    {
      file: pkg.module,
      format: 'esm',
    },
    { external: ['auto-bind'] }
  ),
  build(
    input,
    {
      file: `dist/umd/${pkg.name}.umd.js`,
      format: 'umd',
      name: 'hydreigon',
    },
    { withMin: true }
  )
)
