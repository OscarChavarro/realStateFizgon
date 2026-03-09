import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import {
  DashboardPropertyRow,
  SortCriterion,
  SortDirection,
  SortField,
  SortToggleRequest
} from 'src/app/dashboard/dashboard.types';
import { I18nService, SupportedLanguage } from 'src/app/i18n/i18n.service';

@Component({
  selector: 'app-dashboard-properties-table',
  standalone: true,
  templateUrl: './dashboard-properties-table.component.html',
  styleUrl: './dashboard-properties-table.component.css'
})
export class DashboardPropertiesTableComponent {
  private readonly i18nService = inject(I18nService);

  @Input({ required: true }) properties: DashboardPropertyRow[] = [];
  @Input({ required: true }) sortCriteria: SortCriterion[] = [];
  @Input({ required: true }) selectedLanguage: SupportedLanguage = 'en';
  @Input() lockedRowKey: string | null = null;

  @Output() readonly sortToggle = new EventEmitter<SortToggleRequest>();
  @Output() readonly propertyHover = new EventEmitter<DashboardPropertyRow>();
  @Output() readonly propertySelect = new EventEmitter<DashboardPropertyRow>();

  onSortToggle(sortBy: SortField, sortOrder: SortDirection): void {
    this.sortToggle.emit({ sortBy, sortOrder });
  }

  onPropertyHover(property: DashboardPropertyRow): void {
    this.propertyHover.emit(property);
  }

  onPropertyClick(property: DashboardPropertyRow): void {
    this.propertySelect.emit(property);
  }

  isPropertyRowLocked(property: DashboardPropertyRow): boolean {
    return this.lockedRowKey === this.getPropertyRowKey(property);
  }

  getSortDirection(sortBy: SortField): SortDirection | null {
    const criterion = this.sortCriteria.find((item) => item.sortBy === sortBy);
    return criterion?.sortOrder ?? null;
  }

  getSortPriority(sortBy: SortField): number | null {
    const index = this.sortCriteria.findIndex((item) => item.sortBy === sortBy);
    if (index < 0) {
      return null;
    }

    return index + 1;
  }

  shouldShowSortPriority(sortBy: SortField): boolean {
    return this.sortCriteria.length > 1 && this.getSortPriority(sortBy) !== null;
  }

  trackProperty(_index: number, property: DashboardPropertyRow): string {
    return this.getPropertyRowKey(property);
  }

  t(id: string): string {
    return this.i18nService.get(id, this.selectedLanguage);
  }

  private getPropertyRowKey(property: DashboardPropertyRow): string {
    return `${property.propertyId}|${property.url}|${property.createdAt}|${property.title}`;
  }
}
