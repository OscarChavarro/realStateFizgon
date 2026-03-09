import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { DashboardTab } from 'src/app/dashboard/dashboard.types';
import { I18nService, SupportedLanguage } from 'src/app/i18n/i18n.service';

@Component({
  selector: 'app-dashboard-top-bar',
  standalone: true,
  templateUrl: './dashboard-top-bar.component.html',
  styleUrl: './dashboard-top-bar.component.css'
})
export class DashboardTopBarComponent {
  private readonly i18nService = inject(I18nService);
  private lastTouchPointerUpAtMs = 0;

  @Input({ required: true }) activeTab: DashboardTab = 'DASHBOARD';
  @Input({ required: true }) count = 0;
  @Input({ required: true }) loading = false;
  @Input({ required: true }) selectedLanguage: SupportedLanguage = 'en';

  @Output() readonly tabChange = new EventEmitter<DashboardTab>();
  @Output() readonly languageChange = new EventEmitter<SupportedLanguage>();
  @Output() readonly fullscreenRequest = new EventEmitter<void>();

  selectTab(tab: DashboardTab): void {
    this.tabChange.emit(tab);
  }

  onLanguageSelect(value: string): void {
    this.languageChange.emit(value === 'sp' ? 'sp' : 'en');
  }

  onTopBarDoubleClick(): void {
    this.fullscreenRequest.emit();
  }

  onTopBarPointerUp(event: PointerEvent): void {
    if (event.pointerType !== 'touch') {
      return;
    }

    const now = Date.now();
    const delta = now - this.lastTouchPointerUpAtMs;
    this.lastTouchPointerUpAtMs = now;

    if (delta <= 350) {
      this.lastTouchPointerUpAtMs = 0;
      this.fullscreenRequest.emit();
    }
  }

  t(id: string): string {
    return this.i18nService.get(id, this.selectedLanguage);
  }
}
