import { DatabaseMaintenanceOperation } from 'src/app/maintenance/model/database-maintenance-operation';

export class RemoveDanglingImagesOperation extends DatabaseMaintenanceOperation {
  constructor() {
    super('REMOVE_DANGLING_IMAGES', '/removeDanglingImages');
  }
}
