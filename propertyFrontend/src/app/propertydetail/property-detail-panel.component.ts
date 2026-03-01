import { Component, Input, inject } from '@angular/core';
import { I18nService, SupportedLanguage } from '../i18n/i18n.service';

export type PropertyDetailViewModel = {
  createdAt: string;
  title: string;
  url: string;
  price: string;
  location: string;
  propertyId: string;
  localImageUrls: string[];
};

@Component({
  selector: 'app-property-detail-panel',
  standalone: true,
  templateUrl: './property-detail-panel.component.html',
  styleUrl: './property-detail-panel.component.css'
})
export class PropertyDetailPanelComponent {
  private readonly i18nService = inject(I18nService);

  @Input() property: PropertyDetailViewModel | null = null;
  @Input() selectedLanguage: SupportedLanguage = 'en';

  t(id: string): string {
    return this.i18nService.get(id, this.selectedLanguage);
  }
}
