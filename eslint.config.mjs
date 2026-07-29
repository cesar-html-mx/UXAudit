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
  {
    files: ['src/**/*.ts'],
    ignores: ['src/parsing/babel/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@babel/*'],
              message:
                'Babel imports must remain inside src/parsing/babel; other modules consume UXAudit-owned contracts.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/domain/**/*.ts', 'src/rules/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@babel/*', '**/parsing/babel/**'],
              message:
                'Domain and rule modules must consume the AST-free UXAudit analysis model, never Babel or its adapter.',
            },
          ],
        },
      ],
    },
  },
);
