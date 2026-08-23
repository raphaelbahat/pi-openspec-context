import js from '@eslint/js';

export default [
  {
    ignores: ['node_modules/**', 'dist/**', '.superpowers/**'],
  },
  {
    files: ['**/*.js', '**/*.ts', '**/*.tsx'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaVersion: 2022,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
    },
  },
];
