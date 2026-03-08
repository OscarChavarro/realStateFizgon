import { jest } from '@jest/globals';

export class LoggerLikeMock {
  readonly log = jest.fn<(message: string) => void>();
  readonly warn = jest.fn<(message: string) => void>();
}
