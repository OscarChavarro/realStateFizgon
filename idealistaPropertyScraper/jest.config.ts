import type { Config } from 'jest';

const config: Config = {
  rootDir: '.',
  roots: ['<rootDir>/src/test'],
  testEnvironment: 'node',
  testMatch: ['**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
  },
  moduleNameMapper: {
    '^@real-state-fizgon/captcha-solvers$': '<rootDir>/src/test/support/mocks/captcha-solvers.mock.ts',
    '^src/(.*)$': '<rootDir>/src/main/$1'
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
  coverageReporters: ['text-summary', 'lcov', 'cobertura', 'html']
};

export default config;
