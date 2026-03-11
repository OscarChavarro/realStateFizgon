import { Property } from 'src/domain/property/property.model';
import { SavePropertyResult } from 'src/ports/outbound/persistence/save-property-result.type';

export interface PropertyPersistencePort {
  saveProperty(property: Property): Promise<SavePropertyResult>;
  saveClosedProperty(url: string, closedBy?: Date): Promise<void>;
  isOpenPropertyByUrl(url: string): Promise<boolean>;
  touchPropertyLastTimeVisited(url: string, visitedAt?: Date): Promise<void>;
  getOpenPropertyUrlsWithoutLastTimeVisited(): Promise<string[]>;
  getOpenPropertyUrls(): Promise<string[]>;
  validateConnectionOrExit(): Promise<void>;
}
