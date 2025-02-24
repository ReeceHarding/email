/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  },
  setupFilesAfterEnv: [
    '<rootDir>/__tests__/jest-setup.ts'
  ],
  testMatch: [
    '**/__tests__/**/*.test.ts'
  ],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        isolatedModules: true,
        diagnostics: {
          // Suppress TypeScript errors related to Jest matchers
          warnOnly: true
        }
      }
    ]
  },
  // Handle TypeScript Errors
  globals: {
    'ts-jest': {
      diagnostics: {
        warnOnly: true
      }
    }
  }
}; 