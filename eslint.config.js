import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default [
  { ignores: ['**/node_modules/**', '**/dist/**', '**/.env', '**/.env.*'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['**/*.{js,ts,tsx}'], languageOptions: { globals: globals.node } },
  { files: ['apps/web/src/**/*.{ts,tsx}'], languageOptions: { globals: globals.browser } },
];
