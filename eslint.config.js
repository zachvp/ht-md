const globals = require('globals')

module.exports = [
  {
    files: ['eslint.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['*.js'],
    ignores: ['eslint.config.js', 'turndown.js'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        // extension namespace globals (firefox / chrome)
        browser: 'readonly',
        chrome: 'readonly',
        // service worker global (chrome background)
        importScripts: 'readonly',
        // shared via browser.js
        BROWSER: 'readonly',
        api: 'readonly',
        // shared via turndown.js
        TurndownService: 'readonly',
      },
    },
    rules: {
      'no-redeclare': 'error',
      'no-undef': 'error',
      'no-unused-vars': ['warn', { varsIgnorePattern: '^(api|BROWSER)$' }],
    },
  },
]
