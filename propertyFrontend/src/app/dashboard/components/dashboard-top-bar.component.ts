import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { AuthenticatedUser } from 'src/app/dashboard/auth/authenticated-user.model';
import { DashboardTab } from 'src/app/dashboard/dashboard.types';
import { DashboardUserMenuComponent } from 'src/app/dashboard/auth/components/dashboard-user-menu.component';
import {
  DashboardFiltersState,
  createDefaultDashboardFilters
} from 'src/app/dashboard/filters/dashboard-filters.model';
import { DashboardFilterMenuComponent } from 'src/app/dashboard/filters/components/dashboard-filter-menu.component';
import { I18nService, SupportedLanguage, TranslationKey } from 'src/app/i18n/i18n.service';

@Component({
  selector: 'app-dashboard-top-bar',
  standalone: true,
  imports: [DashboardFilterMenuComponent, DashboardUserMenuComponent],
  templateUrl: './dashboard-top-bar.component.html',
  styleUrl: './dashboard-top-bar.component.css'
})
export class DashboardTopBarComponent {
  private readonly i18nService = inject(I18nService);

  @Input({ required: true }) activeTab: DashboardTab = 'DASHBOARD';
  @Input({ required: true }) visibleCount = 0;
  @Input({ required: true }) totalCount = 0;
  @Input({ required: true }) loading = false;
  @Input({ required: true }) selectedLanguage: SupportedLanguage = 'en';
  @Input({ required: true }) filters: DashboardFiltersState = createDefaultDashboardFilters();
  @Input({ required: true }) layoutCycleIcon = 'vertical_split';
  @Input() googleLoginEnabled = true;
  @Input() authenticatedUser: AuthenticatedUser | null = null;
  @Input() authenticatedUserAvatarUrl: string | null = null;
  @Input() canEditUsers = false;
  @Input() canMaintainDatabase = false;

  @Output() readonly tabChange = new EventEmitter<DashboardTab>();
  @Output() readonly languageChange = new EventEmitter<SupportedLanguage>();
  @Output() readonly filtersChange = new EventEmitter<DashboardFiltersState>();
  @Output() readonly layoutCycleRequest = new EventEmitter<void>();
  @Output() readonly fullscreenRequest = new EventEmitter<void>();
  @Output() readonly googleLoginRequest = new EventEmitter<void>();
  @Output() readonly logoutRequest = new EventEmitter<void>();

  selectTab(tab: DashboardTab): void {
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

  onFiltersUpdate(filters: DashboardFiltersState): void {
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
