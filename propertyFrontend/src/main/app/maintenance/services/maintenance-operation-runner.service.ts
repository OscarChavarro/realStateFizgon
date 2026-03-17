import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { DatabaseMaintenanceOperation } from 'src/app/maintenance/model/database-maintenance-operation';

@Injectable({
  providedIn: 'root'
})
export class MaintenanceOperationRunnerService {
  async runOperation(operation: DatabaseMaintenanceOperation, http: HttpClient): Promise<string> {
    try {
      const result = await operation.execute(http);
      return JSON.stringify(
        {
          status: result.status,
          body: result.body
        },
        null,
        2
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return JSON.stringify(
        {
          status: 'request-failed',
          error: message
        },
        null,
        2
      );
    }
  }
}
