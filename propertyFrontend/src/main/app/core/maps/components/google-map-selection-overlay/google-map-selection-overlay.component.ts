import { Component, EventEmitter, Input, Output } from '@angular/core';
import { SupportedLanguage } from 'src/app/core/i18n/types/supported-language.type';
import { PropertyMiniSummaryComponent } from 'src/app/core/maps/components/property-mini-summary/property-mini-summary.component';
import { GoogleMapProperty } from 'src/app/core/maps/model/google-map-property.model';

@Component({
  selector: 'app-google-map-selection-overlay',
  standalone: true,
  imports: [PropertyMiniSummaryComponent],
  templateUrl: './google-map-selection-overlay.component.html'
})
export class GoogleMapSelectionOverlayComponent {
  @Input({ required: true }) property!: GoogleMapProperty;
  @Input({ required: true }) selectedLanguage: SupportedLanguage = 'en';
  @Output() readonly closeRequested = new EventEmitter<void>();

  onCloseRequested(): void {
    this.closeRequested.emit();
  }
}
