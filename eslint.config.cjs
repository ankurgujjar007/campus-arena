const globals = require('globals');
module.exports = [
  { ignores: ['**/node_modules/**', '**/dist/**', 'backend/.demo-backups/**'] },
  {
    files: ['frontend/**/*.js', 'frontend/**/*.jsx'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } }
    },
    rules: {
      'no-unreachable': 'error',
      'no-undef': 'error',
      'no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^[A-Z]',
          argsIgnorePattern: '^_',
          caughtErrors: 'none',
          ignoreRestSiblings: true
        }
      ]
    }
  },
  {
    files: ['backend/**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'commonjs', globals: globals.node },
    rules: {
      'no-unreachable': 'error',
      'no-undef': 'error',
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrors: 'none', ignoreRestSiblings: true }
      ]
    }
  }
];
