import { jest } from '@jest/globals';
import { Property } from 'src/domain/property/property.model';

export class PropertyPersistencePortMock {
  readonly saveProperty = jest.fn<(property: Property) => Promise<void>>();
  readonly saveClosedProperty = jest.fn<(url: string, closedBy?: Date) => Promise<void>>();
  readonly isOpenPropertyByUrl = jest.fn<(url: string) => Promise<boolean>>();
  readonly touchPropertyLastTimeVisited = jest.fn<(url: string, visitedAt?: Date) => Promise<void>>();
  readonly getOpenPropertyUrlsWithoutLastTimeVisited = jest.fn<() => Promise<string[]>>();
  readonly getOpenPropertyUrls = jest.fn<() => Promise<string[]>>();
  readonly validateConnectionOrExit = jest.fn<() => Promise<void>>();
}
