export default [
  {
    files: ['src/**/*.js', 'bin/**/*.js', 'scripts/**/*.mjs', 'test.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-console': 'off',
      'no-undef': 'off',
      'no-constant-condition': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }]
    }
  }
];
