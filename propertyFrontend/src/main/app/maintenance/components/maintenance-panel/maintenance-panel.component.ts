import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { DatabaseMaintenanceOperation } from 'src/app/maintenance/model/database-maintenance-operation';
import { I18nService } from 'src/app/core/i18n/services/i18n.service';
import { TranslationKey } from 'src/app/core/i18n/translations/translations-by-namespace.const';
import { SupportedLanguage } from 'src/app/core/i18n/types/supported-language.type';

@Component({
  selector: 'app-maintenance-panel',
  standalone: true,
  templateUrl: './maintenance-panel.component.html',
  styleUrl: './maintenance-panel.component.scss'
})
export class MaintenancePanelComponent {
  private readonly i18nService = inject(I18nService);

  @Input({ required: true }) maintenanceOperations: DatabaseMaintenanceOperation[] = [];
  @Input({ required: true }) maintenanceRunning = false;
  @Input({ required: true }) maintenanceResultText = '';
  @Input({ required: true }) selectedLanguage: SupportedLanguage = 'en';

  @Output() readonly operationRequested = new EventEmitter<DatabaseMaintenanceOperation>();

  requestOperation(operation: DatabaseMaintenanceOperation): void {
    this.operationRequested.emit(operation);
  }

  t(id: TranslationKey): string {
    return this.i18nService.get(id, this.selectedLanguage);
  }
}
