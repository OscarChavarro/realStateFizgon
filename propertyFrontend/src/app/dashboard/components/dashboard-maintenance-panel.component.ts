import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { DatabaseMaintenanceOperation } from 'src/app/databasemaintenance/database-maintenance-operation';
import { I18nService, SupportedLanguage } from 'src/app/i18n/i18n.service';

@Component({
  selector: 'app-dashboard-maintenance-panel',
  standalone: true,
  templateUrl: './dashboard-maintenance-panel.component.html',
  styleUrl: './dashboard-maintenance-panel.component.css'
})
export class DashboardMaintenancePanelComponent {
  private readonly i18nService = inject(I18nService);

  @Input({ required: true }) maintenanceOperations: DatabaseMaintenanceOperation[] = [];
  @Input({ required: true }) maintenanceRunning = false;
  @Input({ required: true }) maintenanceResultText = '';
  @Input({ required: true }) selectedLanguage: SupportedLanguage = 'en';

  @Output() readonly operationRequested = new EventEmitter<DatabaseMaintenanceOperation>();

  requestOperation(operation: DatabaseMaintenanceOperation): void {
    this.operationRequested.emit(operation);
  }

  t(id: string): string {
    return this.i18nService.get(id, this.selectedLanguage);
  }
}
