import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  inject
} from '@angular/core';
import {
  ListingPropertyRow,
  PropertyLabelEntry,
  PropertyReviewLabel,
  SortCriterion,
  SortDirection,
  SortField,
  SortToggleRequest
} from 'src/app/listing/model/listing.types';
import { ListingPaginationControlsComponent } from 'src/app/listing/components/listing-pagination-controls/listing-pagination-controls.component';
import {
  I18nService,
  SupportedLanguage,
  TranslationKey
} from 'src/app/core/i18n/services/i18n.service';

@Component({
  selector: 'app-listing-properties-table',
  standalone: true,
  imports: [ListingPaginationControlsComponent],
  templateUrl: './listing-properties-table.component.html',
  styleUrl: './listing-properties-table.component.scss'
})
export class ListingPropertiesTableComponent {
  private readonly i18nService = inject(I18nService);
  @ViewChild('tableScrollContainer') private tableWrapperContainer?: ElementRef<HTMLDivElement>;

  @Input({ required: true }) properties: ListingPropertyRow[] = [];
  @Input({ required: true }) sortCriteria: SortCriterion[] = [];
  @Input({ required: true }) selectedLanguage: SupportedLanguage = 'en';
  @Input() lockedRowKey: string | null = null;
  @Input() reviewEnabled = false;
  @Input() propertyLabels: PropertyLabelEntry[] = [];
  @Input() page = 1;
  @Input() pageSize = 100;
  @Input() totalPages = 0;
  @Input() loading = false;

  @Output() readonly sortToggle = new EventEmitter<SortToggleRequest>();
  @Output() readonly propertyHover = new EventEmitter<ListingPropertyRow>();
  @Output() readonly propertySelect = new EventEmitter<ListingPropertyRow>();
  @Output() readonly propertyReviewToggle = new EventEmitter<ListingPropertyRow>();
  @Output() readonly pageChange = new EventEmitter<number>();
  @Output() readonly pageSizeChange = new EventEmitter<number>();

  onSortToggle(sortBy: SortField): void {
    this.sortToggle.emit({ sortBy });
  }

  onPropertyHover(property: ListingPropertyRow): void {
    this.propertyHover.emit(property);
  }

  onPropertyClick(property: ListingPropertyRow): void {
    this.propertySelect.emit(property);
  }

  onPropertyReviewCellClick(event: MouseEvent, property: ListingPropertyRow): void {
    event.stopPropagation();
    this.propertyReviewToggle.emit(property);
  }

  onPageChange(page: number): void {
    this.pageChange.emit(page);
  }

  onPageSizeChange(pageSize: number): void {
    this.pageSizeChange.emit(pageSize);
  }

  getDisplayRowIndex(rowIndex: number): number {
    const normalizedPage = Number.isFinite(this.page) && this.page >= 1 ? Math.floor(this.page) : 1;
    const normalizedPageSize =
      Number.isFinite(this.pageSize) && this.pageSize >= 1 ? Math.floor(this.pageSize) : 100;
    const base = (normalizedPage - 1) * normalizedPageSize;
    return base + rowIndex + 1;
  }

  isPropertyRowLocked(property: ListingPropertyRow): boolean {
    return this.lockedRowKey === this.getPropertyRowKey(property);
  }

  getSortDirection(sortBy: SortField): SortDirection | null {
    const criterion = this.sortCriteria.find((item) => item.sortBy === sortBy);
    return criterion?.sortOrder ?? null;
  }

  getSortIcon(sortBy: SortField): string {
    const direction = this.getSortDirection(sortBy);
    if (direction === 'asc') {
      return 'arrow_upward';
    }
    if (direction === 'desc') {
      return 'arrow_downward';
    }
    return 'swap_vert';
  }

  getSortAriaLabel(sortBy: SortField): string {
    const direction = this.getSortDirection(sortBy);
    if (direction === 'asc') {
      return `${this.t('SORT_DESC')} ${this.getSortFieldLabel(sortBy)}`;
    }
    if (direction === 'desc') {
      return `${this.t('SORT_DISABLED')} ${this.getSortFieldLabel(sortBy)}`;
    }
    return `${this.t('SORT_ASC')} ${this.getSortFieldLabel(sortBy)}`;
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

  trackProperty(_index: number, property: ListingPropertyRow): string {
    return this.getPropertyRowKey(property);
  }

  scrollPropertyIntoView(property: ListingPropertyRow): void {
    const container = this.tableWrapperContainer?.nativeElement.querySelector<HTMLDivElement>(
      '.spreadsheet-table-scroll'
    );
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

  getReviewClass(property: ListingPropertyRow): string {
    const review = this.getReview(property.propertyId);
    if (review === 'FAVOURITE') {
      return 'favourite';
    }
    if (review === 'DISCHARGED') {
      return 'discharged';
    }
    return 'new';
  }

  getReviewIcon(property: ListingPropertyRow): string {
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

  private getSortFieldLabel(sortBy: SortField): string {
    if (sortBy === 'title') {
      return this.t('TITLE');
    }
    if (sortBy === 'publicationDate') {
      return this.t('PUBLICATION_DATE');
    }
    return this.t('PRICE');
  }

  private getPropertyRowKey(property: ListingPropertyRow): string {
    return `${property.propertyId}|${property.url}|${property.publicationDate}|${property.title}`;
  }
}
