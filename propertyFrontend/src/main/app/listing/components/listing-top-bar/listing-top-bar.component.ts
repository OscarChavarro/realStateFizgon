import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { AuthenticatedUser } from 'src/app/auth/model/authenticated-user.model';
import { ListingTab } from 'src/app/listing/model/listing.types';
import { UserMenuComponent } from 'src/app/auth/components/user-menu/user-menu.component';
import {
  ListingFiltersState,
  createDefaultListingFilters
} from 'src/app/listing/model/filters/listing-filters.model';
import { ListingFilterMenuComponent } from 'src/app/listing/components/listing-filter-menu/listing-filter-menu.component';
import { I18nService, SupportedLanguage, TranslationKey } from 'src/app/core/i18n/services/i18n.service';

@Component({
  selector: 'app-listing-top-bar',
  standalone: true,
  imports: [ListingFilterMenuComponent, UserMenuComponent],
  templateUrl: './listing-top-bar.component.html',
  styleUrl: './listing-top-bar.component.css'
})
export class ListingTopBarComponent {
  private readonly i18nService = inject(I18nService);

  @Input({ required: true }) activeTab: ListingTab = 'DASHBOARD';
  @Input({ required: true }) visibleCount = 0;
  @Input({ required: true }) totalCount = 0;
  @Input({ required: true }) loading = false;
  @Input({ required: true }) selectedLanguage: SupportedLanguage = 'en';
  @Input({ required: true }) filters: ListingFiltersState = createDefaultListingFilters();
  @Input({ required: true }) layoutCycleIcon = 'vertical_split';
  @Input() googleLoginEnabled = true;
  @Input() authenticatedUser: AuthenticatedUser | null = null;
  @Input() authenticatedUserAvatarUrl: string | null = null;
  @Input() canEditUsers = false;
  @Input() canMaintainDatabase = false;

  @Output() readonly tabChange = new EventEmitter<ListingTab>();
  @Output() readonly languageChange = new EventEmitter<SupportedLanguage>();
  @Output() readonly filtersChange = new EventEmitter<ListingFiltersState>();
  @Output() readonly layoutCycleRequest = new EventEmitter<void>();
  @Output() readonly fullscreenRequest = new EventEmitter<void>();
  @Output() readonly googleLoginRequest = new EventEmitter<void>();
  @Output() readonly logoutRequest = new EventEmitter<void>();

  selectTab(tab: ListingTab): void {
    this.tabChange.emit(tab);
  }

  onLanguageSelect(value: string): void {
    this.languageChange.emit(value === 'sp' ? 'sp' : 'en');
  }

  onFullscreenButtonClick(): void {
    this.fullscreenRequest.emit();
  }

  onLayoutCycleButtonClick(): void {
    this.layoutCycleRequest.emit();
  }

  onFiltersUpdate(filters: ListingFiltersState): void {
    this.filtersChange.emit(filters);
  }

  onGoogleLoginClicked(): void {
    this.googleLoginRequest.emit();
  }

  onLogoutClicked(): void {
    this.logoutRequest.emit();
  }

  t(id: TranslationKey): string {
    return this.i18nService.get(id, this.selectedLanguage);
  }
}
