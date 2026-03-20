import { jest } from '@jest/globals';
import { Property } from 'domain/property/property.model';
import { PersistenceHealthPort } from 'ports/outbound/persistence/persistence-health.port';
import { PropertyReadPort } from 'ports/outbound/persistence/property-read.port';
import { SavePropertyResult } from 'ports/outbound/persistence/save-property-result.type';
import { PropertyWritePort } from 'ports/outbound/persistence/property-write.port';

export class PropertyPersistencePortMock implements PropertyWritePort, PropertyReadPort, PersistenceHealthPort {
  readonly saveProperty = jest.fn<(property: Property) => Promise<SavePropertyResult>>();
  readonly saveClosedProperty = jest.fn<(url: string, closedBy?: Date) => Promise<void>>();
  readonly isOpenPropertyByUrl = jest.fn<(url: string) => Promise<boolean>>();
  readonly hasGeoLocationHintByUrl = jest.fn<(url: string) => Promise<boolean>>();
  readonly touchPropertyLastTimeVisited = jest.fn<(url: string, visitedAt?: Date) => Promise<void>>();
  readonly getOpenPropertyUrlsWithoutLastTimeVisited = jest.fn<() => Promise<string[]>>();
  readonly getOpenPropertyUrls = jest.fn<() => Promise<string[]>>();
  readonly validateConnectionOrExit = jest.fn<() => Promise<void>>();
}
