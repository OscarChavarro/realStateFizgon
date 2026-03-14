import { Component, ElementRef, EventEmitter, Input, Output, ViewChild, inject } from '@angular/core';
import {
  DashboardPropertyRow,
  PropertyLabelEntry,
  PropertyReviewLabel,
  SortCriterion,
  SortDirection,
  SortField,
  SortToggleRequest
} from 'src/app/dashboard/dashboard.types';
import { I18nService, SupportedLanguage, TranslationKey } from 'src/app/i18n/i18n.service';

@Component({
  selector: 'app-dashboard-properties-table',
  standalone: true,
  templateUrl: './dashboard-properties-table.component.html',
  styleUrl: './dashboard-properties-table.component.css'
})
export class DashboardPropertiesTableComponent {
  private readonly i18nService = inject(I18nService);
  @ViewChild('tableScrollContainer') private tableScrollContainer?: ElementRef<HTMLDivElement>;

  @Input({ required: true }) properties: DashboardPropertyRow[] = [];
  @Input({ required: true }) sortCriteria: SortCriterion[] = [];
  @Input({ required: true }) selectedLanguage: SupportedLanguage = 'en';
  @Input() lockedRowKey: string | null = null;
  @Input() reviewEnabled = false;
  @Input() propertyLabels: PropertyLabelEntry[] = [];

  @Output() readonly sortToggle = new EventEmitter<SortToggleRequest>();
  @Output() readonly propertyHover = new EventEmitter<DashboardPropertyRow>();
  @Output() readonly propertySelect = new EventEmitter<DashboardPropertyRow>();
  @Output() readonly propertyReviewToggle = new EventEmitter<DashboardPropertyRow>();

  onSortToggle(sortBy: SortField, sortOrder: SortDirection): void {
    this.sortToggle.emit({ sortBy, sortOrder });
  }

  onPropertyHover(property: DashboardPropertyRow): void {
    this.propertyHover.emit(property);
  }

  onPropertyClick(property: DashboardPropertyRow): void {
    this.propertySelect.emit(property);
  }

  onPropertyReviewCellClick(event: MouseEvent, property: DashboardPropertyRow): void {
    event.stopPropagation();
    this.propertyReviewToggle.emit(property);
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

  scrollPropertyIntoView(property: DashboardPropertyRow): void {
    const container = this.tableScrollContainer?.nativeElement;
    if (!container) {
      return;
    }

    const rowKey = this.getPropertyRowKey(property);
    const rows = Array.from(container.querySelectorAll<HTMLTableRowElement>('tr.property-row'));
    const targetRow = rows.find((row) => row.dataset['rowKey'] === rowKey);
    if (!targetRow) {
      return;
    }

    const rowTop = targetRow.offsetTop;
    const rowBottom = rowTop + targetRow.offsetHeight;
    const viewportTop = container.scrollTop;
    const viewportBottom = viewportTop + container.clientHeight;
    const headerHeight = container.querySelector('thead')?.clientHeight ?? 0;
    const effectiveTop = viewportTop + headerHeight;
    const targetTop = Math.max(0, rowTop - headerHeight);

    if (rowTop < effectiveTop || rowBottom > viewportBottom) {
      container.scrollTo({
        top: targetTop,
        behavior: 'auto'
      });
      return;
    }

    const relativeTop = rowTop - effectiveTop;
    if (relativeTop > container.clientHeight * 0.6) {
      container.scrollTo({
        top: targetTop,
        behavior: 'auto'
      });
    }
  }

  t(id: TranslationKey): string {
    return this.i18nService.get(id, this.selectedLanguage);
  }

  getReviewClass(property: DashboardPropertyRow): string {
    const review = this.getReview(property.propertyId);
    if (review === 'FAVOURITE') {
      return 'favourite';
    }
    if (review === 'DISCHARGED') {
      return 'discharged';
    }
    return 'new';
  }

  getReviewIcon(property: DashboardPropertyRow): string {
    const review = this.getReview(property.propertyId);
    if (review === 'FAVOURITE') {
      return 'check';
    }
    if (review === 'DISCHARGED') {
      return 'close';
    }
    return 'flare';
  }

  private getReview(propertyId: string): PropertyReviewLabel {
    const labels = this.propertyLabels.find((item) => item.propertyId === propertyId)?.labels;
    const review = labels?.review;
    if (review === 'NEW' || review === 'FAVOURITE' || review === 'DISCHARGED') {
      return review;
    }
    return 'NEW';
  }

  private getPropertyRowKey(property: DashboardPropertyRow): string {
    return `${property.propertyId}|${property.url}|${property.publicationDate}|${property.title}`;
  }
}
