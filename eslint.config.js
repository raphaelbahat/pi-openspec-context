import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: ['node_modules/**', 'dist/**', '.superpowers/**', 'docker/**'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.js'],
    ...js.configs.recommended,
    rules: {
      ...js.configs.recommended.rules,
    },
  },
];
