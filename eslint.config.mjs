import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules/**', 'dist/**', 'coverage/**', 'paquets/**', 'docs/**', 'src/assets/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // El codi propi no fa servir eval ni new Function (spec §5).
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-implied-eval': 'error'
    }
  },
  {
    files: ['src/**/*.test.{ts,tsx}', 'src/test/**'],
    languageOptions: { globals: { ...globals.jest, ...globals.node } }
  },
  {
    files: ['scripts/**/*.mjs', '*.mjs', '*.cjs', 'src/test/**/*.cjs'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
    languageOptions: { globals: { ...globals.node } }
  }
);
