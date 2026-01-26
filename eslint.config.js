import js from '@eslint/js'
import prettierConfig from 'eslint-config-prettier'
import prettierPlugin from 'eslint-plugin-prettier'

export default [
  js.configs.recommended,
  prettierConfig,
  {
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      'prettier/prettier': 'error',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'wrangler.toml'],
  },
]
