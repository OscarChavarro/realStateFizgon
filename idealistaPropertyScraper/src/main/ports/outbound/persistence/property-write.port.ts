import { Property } from 'domain/property/property';
import { SavePropertyResult } from 'ports/outbound/persistence/save-property-result.type';

export interface PropertyWritePort {
  saveProperty(property: Property): Promise<SavePropertyResult>;
  saveClosedProperty(url: string, closedBy?: Date): Promise<void>;
  touchPropertyLastTimeVisited(url: string, visitedAt?: Date): Promise<void>;
}
