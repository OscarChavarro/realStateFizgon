import { DatabaseMaintenanceOperation } from 'src/app/maintenance/model/database-maintenance-operation';

export class RemoveDanglingImagesOperation extends DatabaseMaintenanceOperation {
  constructor() {
    super('maintenance.REMOVE_DANGLING_IMAGES', '/removeDanglingImages');
  }
}
