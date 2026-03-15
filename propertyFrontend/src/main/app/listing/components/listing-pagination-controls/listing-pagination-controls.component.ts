import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import {
  DASHBOARD_PAGE_SIZE_OPTIONS,
} from 'src/app/listing/model/pagination/listing-pagination.model';
import { I18nService, SupportedLanguage, TranslationKey } from 'src/app/core/i18n/services/i18n.service';

@Component({
  selector: 'app-listing-pagination-controls',
  standalone: true,
  templateUrl: './listing-pagination-controls.component.html',
  styleUrl: './listing-pagination-controls.component.scss'
})
export class ListingPaginationControlsComponent {
  private readonly i18nService = inject(I18nService);
  readonly pageSizeOptions = DASHBOARD_PAGE_SIZE_OPTIONS;

  @Input({ required: true }) selectedLanguage: SupportedLanguage = 'en';
  @Input() page = 1;
  @Input() pageSize = 100;
  @Input() totalPages = 0;
  @Input() loading = false;

  @Output() readonly pageChange = new EventEmitter<number>();
  @Output() readonly pageSizeChange = new EventEmitter<number>();

  normalizedCurrentPage(): number {
    if (this.totalPages <= 0) {
      return 0;
    }
    return Math.min(Math.max(this.page, 1), this.totalPages);
  }

  visiblePages(): number[] {
    if (this.totalPages <= 0) {
      return [];
    }

    const maxButtons = 7;
    let start = Math.max(1, this.normalizedCurrentPage() - Math.floor(maxButtons / 2));
    let end = Math.min(this.totalPages, start + maxButtons - 1);
    start = Math.max(1, end - maxButtons + 1);
    const pages: number[] = [];
    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }
    return pages;
  }

  selectablePageSizes(): number[] {
    return [...this.pageSizeOptions];
  }

  canGoPrevious(): boolean {
    return !this.loading && this.normalizedCurrentPage() > 1;
  }

  canGoNext(): boolean {
    return !this.loading && this.totalPages > 0 && this.normalizedCurrentPage() < this.totalPages;
  }

  onPreviousClick(): void {
    if (!this.canGoPrevious()) {
      return;
    }
    this.pageChange.emit(this.normalizedCurrentPage() - 1);
  }

  onNextClick(): void {
    if (!this.canGoNext()) {
      return;
    }
    this.pageChange.emit(this.normalizedCurrentPage() + 1);
  }

  onPageNumberClick(page: number): void {
    if (this.loading || page === this.normalizedCurrentPage()) {
      return;
    }
    this.pageChange.emit(page);
  }

  onPageSizeSelect(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) {
      return;
    }

    const parsed = Number.parseInt(target.value, 10);
    if (Number.isFinite(parsed) && parsed >= 1) {
      this.pageSizeChange.emit(parsed);
    }
  }

  t(id: TranslationKey): string {
    return this.i18nService.get(id, this.selectedLanguage);
  }
}
