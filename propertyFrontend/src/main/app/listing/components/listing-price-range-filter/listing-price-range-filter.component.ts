import { HttpClient } from '@angular/common/http';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  inject,
  signal
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  I18nService,
  SupportedLanguage,
  TranslationKey
} from 'src/app/core/i18n/services/i18n.service';
import { RequestErrorPolicyService } from 'src/app/core/errors/services/request-error-policy.service';

type PriceRangesResponse = {
  minPrice?: unknown;
  maxPrice?: unknown;
};

@Component({
  selector: 'app-listing-price-range-filter',
  standalone: true,
  templateUrl: './listing-price-range-filter.component.html',
  styleUrl: './listing-price-range-filter.component.scss'
})
export class ListingPriceRangeFilterComponent implements OnInit, OnChanges {
  private static cachedPriceRange: { minPrice: number; maxPrice: number } | null = null;

  private readonly http = inject(HttpClient);
  private readonly i18nService = inject(I18nService);
  private readonly requestErrorPolicyService = inject(RequestErrorPolicyService);

  @Input({ required: true }) selectedLanguage: SupportedLanguage = 'en';
  @Input() minPrice = '';
  @Input() maxPrice = '';

  @Output() readonly minPriceChange = new EventEmitter<string>();
  @Output() readonly maxPriceChange = new EventEmitter<string>();

  readonly loading = signal<boolean>(false);
  readonly hasRange = signal<boolean>(false);
  readonly absoluteMinPrice = signal<number>(0);
  readonly absoluteMaxPrice = signal<number>(0);
  readonly sliderMinPrice = signal<number>(0);
  readonly sliderMaxPrice = signal<number>(0);

  ngOnInit(): void {
    void this.loadPriceRange();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['minPrice'] || changes['maxPrice']) {
      this.syncSliderRangeWithInputs();
    }
  }

  onMinPriceTextInput(rawValue: string): void {
    if (!this.hasRange()) {
      this.minPriceChange.emit(this.normalizeIntegerInput(rawValue));
      return;
    }

    const normalized = this.normalizeIntegerInput(rawValue);
    if (!normalized) {
      this.sliderMinPrice.set(this.absoluteMinPrice());
      this.minPriceChange.emit('');
      return;
    }

    const parsed = this.clampToAbsoluteRange(Number.parseInt(normalized, 10));
    const bounded = Math.min(parsed, this.sliderMaxPrice());
    this.sliderMinPrice.set(bounded);
    this.minPriceChange.emit(String(bounded));
  }

  onMaxPriceTextInput(rawValue: string): void {
    if (!this.hasRange()) {
      this.maxPriceChange.emit(this.normalizeIntegerInput(rawValue));
      return;
    }

    const normalized = this.normalizeIntegerInput(rawValue);
    if (!normalized) {
      this.sliderMaxPrice.set(this.absoluteMaxPrice());
      this.maxPriceChange.emit('');
      return;
    }

    const parsed = this.clampToAbsoluteRange(Number.parseInt(normalized, 10));
    const bounded = Math.max(parsed, this.sliderMinPrice());
    this.sliderMaxPrice.set(bounded);
    this.maxPriceChange.emit(String(bounded));
  }

  onMinSliderInput(rawValue: string): void {
    if (!this.hasRange()) {
      return;
    }

    const parsed = this.parseSliderValue(rawValue, this.absoluteMinPrice());
    const bounded = Math.min(parsed, this.sliderMaxPrice());
    this.sliderMinPrice.set(bounded);
    this.minPriceChange.emit(String(bounded));
  }

  onMaxSliderInput(rawValue: string): void {
    if (!this.hasRange()) {
      return;
    }

    const parsed = this.parseSliderValue(rawValue, this.absoluteMaxPrice());
    const bounded = Math.max(parsed, this.sliderMinPrice());
    this.sliderMaxPrice.set(bounded);
    this.maxPriceChange.emit(String(bounded));
  }

  getSelectedRangeStyle(): string {
    if (!this.hasRange()) {
      return '';
    }

    const min = this.absoluteMinPrice();
    const max = this.absoluteMaxPrice();
    const delta = Math.max(max - min, 1);
    const start = ((this.sliderMinPrice() - min) / delta) * 100;
    const end = ((this.sliderMaxPrice() - min) / delta) * 100;
    const width = Math.max(end - start, 0);
    return `left: ${start}%; width: ${width}%;`;
  }

  t(id: TranslationKey): string {
    return this.i18nService.get(id, this.selectedLanguage);
  }

  private async loadPriceRange(): Promise<void> {
    if (ListingPriceRangeFilterComponent.cachedPriceRange) {
      this.applyPriceRange(ListingPriceRangeFilterComponent.cachedPriceRange);
      return;
    }

    this.loading.set(true);
    try {
      const response = await firstValueFrom(
        this.http.get<PriceRangesResponse>('/properties/getPriceRanges')
      );
      const minPrice = this.toIntegerOrNull(response?.minPrice);
      const maxPrice = this.toIntegerOrNull(response?.maxPrice);
      if (minPrice === null || maxPrice === null || minPrice > maxPrice) {
        this.hasRange.set(false);
        return;
      }

      const range = { minPrice, maxPrice };
      ListingPriceRangeFilterComponent.cachedPriceRange = range;
      this.applyPriceRange(range);
    } catch (error) {
      this.requestErrorPolicyService.notifyFallback(
        'listing.loadPriceRange',
        this.requestErrorPolicyService.classify(error)
      );
      this.hasRange.set(false);
    } finally {
      this.loading.set(false);
    }
  }

  private applyPriceRange(range: { minPrice: number; maxPrice: number }): void {
    this.hasRange.set(true);
    this.absoluteMinPrice.set(range.minPrice);
    this.absoluteMaxPrice.set(range.maxPrice);
    this.syncSliderRangeWithInputs();
  }

  private syncSliderRangeWithInputs(): void {
    if (!this.hasRange()) {
      return;
    }

    const minBound = this.absoluteMinPrice();
    const maxBound = this.absoluteMaxPrice();
    let minPrice = this.parsePriceOrFallback(this.minPrice, minBound);
    let maxPrice = this.parsePriceOrFallback(this.maxPrice, maxBound);
    minPrice = this.clampToAbsoluteRange(minPrice);
    maxPrice = this.clampToAbsoluteRange(maxPrice);
    if (minPrice > maxPrice) {
      if (this.minPrice.trim().length > 0) {
        maxPrice = minPrice;
      } else {
        minPrice = maxPrice;
      }
    }

    this.sliderMinPrice.set(minPrice);
    this.sliderMaxPrice.set(maxPrice);
  }

  private parsePriceOrFallback(value: string, fallback: number): number {
    const normalized = this.normalizeIntegerInput(value);
    if (!normalized) {
      return fallback;
    }

    return Number.parseInt(normalized, 10);
  }

  private parseSliderValue(rawValue: string, fallback: number): number {
    const parsed = Number.parseInt(rawValue, 10);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return this.clampToAbsoluteRange(parsed);
  }

  private clampToAbsoluteRange(value: number): number {
    return Math.max(this.absoluteMinPrice(), Math.min(this.absoluteMaxPrice(), value));
  }

  private normalizeIntegerInput(value: string): string {
    if (typeof value !== 'string') {
      return '';
    }

    return value.replace(/[^\d]/g, '').trim();
  }

  private toIntegerOrNull(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return null;
    }

    return Math.round(value);
  }
}
