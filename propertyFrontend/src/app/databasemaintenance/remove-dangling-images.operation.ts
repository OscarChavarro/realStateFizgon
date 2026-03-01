import { DatabaseMaintenanceOperation } from './database-maintenance-operation';

export class RemoveDanglingImagesOperation extends DatabaseMaintenanceOperation {
  constructor() {
    super('REMOVE_DANGLING_IMAGES', 'http://localhost:8081/removeDanglingImages');
  }
}

