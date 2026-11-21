/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  setupFiles: ['<rootDir>/src/test/setup.cjs'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  transform: {
    '^.+\\.(t|j)sx?$': [
      '@swc/jest',
      {
        jsc: {
          target: 'es2022',
          parser: { syntax: 'typescript', tsx: true },
          transform: { react: { runtime: 'automatic' } }
        },
        // ignoreDynamic: els import() dinàmics es mantenen natius (els tests de scripts/*.mjs els fan servir)
        module: { type: 'commonjs', ignoreDynamic: true }
      }
    ]
  },
  moduleNameMapper: {
    '\\.module\\.css$': '<rootDir>/src/test/stubCss.cjs',
    '\\.(svg|png)$': '<rootDir>/src/test/stubActiu.cjs'
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.test.{ts,tsx}', '!src/typings/**'],
  coverageDirectory: 'coverage'
};
