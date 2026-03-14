import { Component, EventEmitter, HostListener, Input, Output, inject } from '@angular/core';
import { I18nService, SupportedLanguage, TranslationKey } from 'src/app/i18n/i18n.service';

@Component({
  selector: 'app-property-location',
  standalone: true,
  templateUrl: './property-location.component.html',
  styleUrl: './property-location.component.css'
})
export class PropertyLocationComponent {
  private readonly i18nService = inject(I18nService);

  @Input() isOpen = false;
  @Input() propertyTitle = '';
  @Input() latitude: number | null = null;
  @Input() longitude: number | null = null;
  @Input() selectedLanguage: SupportedLanguage = 'en';
  @Output() readonly closeRequested = new EventEmitter<void>();

  t(id: TranslationKey): string {
    return this.i18nService.get(id, this.selectedLanguage);
  }

  onCloseClick(): void {
    this.closeRequested.emit();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (!this.isOpen) {
      return;
    }

    this.closeRequested.emit();
  }
}
