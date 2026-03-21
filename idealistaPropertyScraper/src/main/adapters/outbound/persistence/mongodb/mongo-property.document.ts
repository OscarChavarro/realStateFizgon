import { Document } from 'mongodb';
import { PropertyPrimitives } from 'domain/property/property';

export type MongoPropertyDocument = PropertyPrimitives & Document & {
  importedBy?: Date;
  updatedBy?: Date;
  closedBy?: Date;
  lastTimeVisited?: Date | null;
  publicationDate?: Date;
};
