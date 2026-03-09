import { Component, ElementRef, EventEmitter, HostListener, Input, Output, inject, signal } from '@angular/core';
import {
  DashboardFiltersState,
  createDefaultDashboardFilters
} from 'src/app/dashboard/filters/dashboard-filters.model';
import { I18nService, SupportedLanguage } from 'src/app/i18n/i18n.service';

@Component({
  selector: 'app-dashboard-filter-menu',
  standalone: true,
  templateUrl: './dashboard-filter-menu.component.html',
  styleUrl: './dashboard-filter-menu.component.css'
})
export class DashboardFilterMenuComponent {
  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly i18nService = inject(I18nService);
  readonly menuOpen = signal<boolean>(false);

  @Input({ required: true }) filters: DashboardFiltersState = createDefaultDashboardFilters();
  @Input({ required: true }) selectedLanguage: SupportedLanguage = 'en';

  @Output() readonly filtersChange = new EventEmitter<DashboardFiltersState>();

  onToggleMenu(): void {
    this.menuOpen.update((current) => !current);
  }

  onShowClosedChange(checked: boolean): void {
    this.filtersChange.emit({
      ...this.filters,
      showClosed: checked
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

  t(id: string): string {
    return this.i18nService.get(id, this.selectedLanguage);
  }
}
