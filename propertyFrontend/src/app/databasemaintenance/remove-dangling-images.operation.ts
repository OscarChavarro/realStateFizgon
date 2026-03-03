import { DatabaseMaintenanceOperation } from 'src/app/databasemaintenance/database-maintenance-operation';

export class RemoveDanglingImagesOperation extends DatabaseMaintenanceOperation {
  constructor() {
    super('REMOVE_DANGLING_IMAGES', '/removeDanglingImages');
  }
}
