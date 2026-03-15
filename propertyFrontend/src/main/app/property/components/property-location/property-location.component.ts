import { Component, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges, ViewChild, inject } from '@angular/core';
import { I18nService, SupportedLanguage, TranslationKey } from 'src/app/core/i18n/services/i18n.service';
import { GoogleMapComponent } from 'src/app/core/maps/components/google-map/google-map.component';
import { GoogleMapProperty } from 'src/app/core/maps/model/google-map-property.model';

@Component({
  selector: 'app-property-location',
  standalone: true,
  imports: [GoogleMapComponent],
  templateUrl: './property-location.component.html',
  styleUrl: './property-location.component.scss'
})
export class PropertyLocationComponent implements OnChanges {
  private readonly i18nService = inject(I18nService);

  @Input() isOpen = false;
  @Input() propertyTitle = '';
  @Input() latitude: number | null = null;
  @Input() longitude: number | null = null;
  @Input() googleMapsApiKey: string | null = null;
  @Input() googleMapsMapId: string | null = null;
  @Input() selectedLanguage: SupportedLanguage = 'en';

  @Output() readonly closeRequested = new EventEmitter<void>();
  @ViewChild(GoogleMapComponent) private googleMapComponent?: GoogleMapComponent;

  mapProperties: GoogleMapProperty[] = [];
  isLayerPanelVisible = true;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      setTimeout(() => {
        this.googleMapComponent?.showLayerPanel();
        this.syncLayerPanelStateFromMap();
      }, 0);
    }

    if (changes['propertyTitle'] || changes['latitude'] || changes['longitude']) {
      this.mapProperties = this.buildMapProperties();
    }
  }

  t(id: TranslationKey): string {
    return this.i18nService.get(id, this.selectedLanguage);
  }

  onCloseClick(): void {
    this.closeRequested.emit();
  }

  onLayerPanelToggleClick(): void {
    this.googleMapComponent?.toggleLayerPanelVisibility();
    this.syncLayerPanelStateFromMap();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (!this.isOpen) {
      return;
    }

    this.closeRequested.emit();
  }

  private buildMapProperties(): GoogleMapProperty[] {
    const latitude = this.latitude;
    const longitude = this.longitude;
    if (
      typeof latitude !== 'number'
      || typeof longitude !== 'number'
      || !Number.isFinite(latitude)
      || !Number.isFinite(longitude)
    ) {
      return [];
    }

    return [{
      id: this.propertyTitle || 'selected-property',
      title: this.propertyTitle || '-',
      latitude,
      longitude
    }];
  }

  private syncLayerPanelStateFromMap(): void {
    if (!this.googleMapComponent) {
      return;
    }

    this.isLayerPanelVisible = this.googleMapComponent.isLayerPanelOpen();
  }
}
