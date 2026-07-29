import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const javascriptFiles = ['**/*.js', '**/*.mjs'];
const typeCheckedFiles = ['src/**/*.ts', 'tests/**/*.ts', '*.config.ts'];

export default defineConfig(
  {
    ignores: ['coverage/**', 'dist/**', 'evidence/**/raw/**', 'node_modules/**'],
  },
  {
    files: javascriptFiles,
    extends: [eslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.nodeBuiltin,
      sourceType: 'module',
    },
  },
  {
    files: typeCheckedFiles,
    extends: [
      eslint.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/prefer-readonly': 'error',
    },
  },
);
