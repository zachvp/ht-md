const globals = require('globals')
const tsParser = require('@typescript-eslint/parser')
const tsPlugin = require('@typescript-eslint/eslint-plugin')

module.exports = [
  {
    files: ['eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/*.ts'],
    languageOptions: {
      parser: tsParser,
      globals: {
        ...globals.browser,
        browser: 'readonly',
        chrome: 'readonly',
        importScripts: 'readonly',
      },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^(api|BROWSER)$' }],
    },
  },
]
