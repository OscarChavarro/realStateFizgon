import { Component, Input, inject } from '@angular/core';
import { DashboardPropertyRow } from 'src/app/dashboard/dashboard.types';
import { I18nService, SupportedLanguage } from 'src/app/i18n/i18n.service';
import { PropertyImageCarouselComponent } from 'src/app/propertydetail/property-image-carousel.component';

@Component({
  selector: 'app-property-detail-panel',
  standalone: true,
  imports: [PropertyImageCarouselComponent],
  templateUrl: './property-detail-panel.component.html',
  styleUrl: './property-detail-panel.component.css'
})
export class PropertyDetailPanelComponent {
  private readonly i18nService = inject(I18nService);

  @Input() property: DashboardPropertyRow | null = null;
  @Input() selectedLanguage: SupportedLanguage = 'en';
  @Input() staticMediaBaseUrl = 'http://localhost:666/';

  t(id: string): string {
    return this.i18nService.get(id, this.selectedLanguage);
  }
}
