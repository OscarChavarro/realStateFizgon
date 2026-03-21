import type { Config } from 'jest';

const config: Config = {
  rootDir: '.',
  roots: ['<rootDir>/src/test'],
  testEnvironment: 'node',
  testMatch: ['**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
  },
  setupFilesAfterEnv: ['<rootDir>/src/test/support/jest.setup.ts'],
  moduleDirectories: ['node_modules', '<rootDir>/src/main'],
  moduleNameMapper: {
    '^@real-state-fizgon/captcha-solvers$': '<rootDir>/src/test/support/mocks/captcha-solvers.mock.ts'
  },
  collectCoverageFrom: [
    'src/main/**/*.ts',
    '!src/main/**/*.d.ts',
    '!src/main/**/*.module.ts',
    '!src/main/**/*-payload.type.ts',
    '!src/main/**/*.type.ts',
    '!src/main/main.ts',
    '!src/main/app.module.ts'
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text-summary', 'lcov', 'cobertura', 'html'],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  }
};

export default config;
