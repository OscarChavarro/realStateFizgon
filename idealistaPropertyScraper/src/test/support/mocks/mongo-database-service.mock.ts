import { jest } from '@jest/globals';

export class MongoDatabaseServiceMock {
  readonly isOpenPropertyByUrl = jest.fn<(url: string) => Promise<boolean>>();
  readonly touchPropertyLastTimeVisited = jest.fn<(url: string) => Promise<void>>();
  readonly getOpenPropertyUrlsWithoutLastTimeVisited = jest.fn<() => Promise<string[]>>();
  readonly getOpenPropertyUrls = jest.fn<() => Promise<string[]>>();
}
