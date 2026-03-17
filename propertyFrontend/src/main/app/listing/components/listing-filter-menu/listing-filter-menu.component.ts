import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  inject,
  signal
} from '@angular/core';
import {
  ListingFiltersState,
  createDefaultListingFilters
} from 'src/app/listing/model/filters/listing-filters.model';
import { ListingPriceRangeFilterComponent } from 'src/app/listing/components/listing-price-range-filter/listing-price-range-filter.component';
import { I18nService } from 'src/app/core/i18n/services/i18n.service';
import { TranslationKey } from 'src/app/core/i18n/translations/translations-by-namespace.const';
import { SupportedLanguage } from 'src/app/core/i18n/types/supported-language.type';

@Component({
  selector: 'app-listing-filter-menu',
  standalone: true,
  imports: [ListingPriceRangeFilterComponent],
  templateUrl: './listing-filter-menu.component.html',
  styleUrl: './listing-filter-menu.component.scss'
})
export class ListingFilterMenuComponent {
  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly i18nService = inject(I18nService);
  readonly menuOpen = signal<boolean>(false);

  @Input({ required: true }) filters: ListingFiltersState = createDefaultListingFilters();
  @Input({ required: true }) selectedLanguage: SupportedLanguage = 'en';
  @Input() reviewFiltersEnabled = false;

  @Output() readonly filtersChange = new EventEmitter<ListingFiltersState>();

  onToggleMenu(): void {
    this.menuOpen.update((current) => !current);
  }

  onShowClosedChange(checked: boolean): void {
    this.filtersChange.emit({
      ...this.filters,
      showClosed: checked
    });
  }

  onShowNewChange(checked: boolean): void {
    this.filtersChange.emit({
      ...this.filters,
      showNew: checked
    });
  }

  onShowFavouriteChange(checked: boolean): void {
    this.filtersChange.emit({
      ...this.filters,
      showFavourite: checked
    });
  }

  onShowRejectedChange(checked: boolean): void {
    this.filtersChange.emit({
      ...this.filters,
      showRejected: checked
    });
  }

  onMinPublicationDateChange(value: string): void {
    this.filtersChange.emit({
      ...this.filters,
      minPublicationDate: this.normalizeDateValue(value)
    });
  }

  onMaxPublicationDateChange(value: string): void {
    this.filtersChange.emit({
      ...this.filters,
      maxPublicationDate: this.normalizeDateValue(value)
    });
  }

  onMinPriceChange(value: string): void {
    this.filtersChange.emit({
      ...this.filters,
      minPrice: this.normalizeIntegerValue(value)
    });
  }

  onMaxPriceChange(value: string): void {
    this.filtersChange.emit({
      ...this.filters,
      maxPrice: this.normalizeIntegerValue(value)
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.menuOpen()) {
      return;
    }

    const target = event.target as Node | null;
    if (target && this.hostElement.nativeElement.contains(target)) {
      return;
    }

    this.menuOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.menuOpen.set(false);
  }

  t(id: TranslationKey): string {
    return this.i18nService.get(id, this.selectedLanguage);
  }

  private normalizeDateValue(value: string): string {
    if (typeof value !== 'string') {
      return '';
    }

    return value.trim();
  }

  private normalizeIntegerValue(value: string): string {
    if (typeof value !== 'string') {
      return '';
    }

    return value.replace(/[^\d]/g, '').trim();
  }
}
