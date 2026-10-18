import js from '@eslint/js';
import ts from 'typescript-eslint';
export default ts.config(
  { ignores: ['dist/**', 'dist-server/**', 'node_modules/**', '.test-build/**', 'public/mediapipe/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  { files: ['**/*.{ts,tsx}'], rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } },
  { files: ['scripts/*.mjs'], languageOptions: { globals: { process: 'readonly', console: 'readonly' } } },
  { files: ['public/pose-worker.js'], languageOptions: { globals: { self: 'readonly', importScripts: 'readonly', vision: 'readonly' } } },
);
