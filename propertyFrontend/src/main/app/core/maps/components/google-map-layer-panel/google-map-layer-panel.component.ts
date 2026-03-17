import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { I18nService } from 'src/app/core/i18n/services/i18n.service';
import { TranslationKey } from 'src/app/core/i18n/translations/translations-by-namespace.const';
import { SupportedLanguage } from 'src/app/core/i18n/types/supported-language.type';
import {
  GoogleMapLayerId,
  GoogleMapLayerOption,
  GoogleMapVisualStyleId,
  GoogleMapVisualStyleOption
} from 'src/app/core/maps/model/google-map-layers.model';

type LayerToggleEvent = {
  id: GoogleMapLayerId;
  checked: boolean;
};

@Component({
  selector: 'app-google-map-layer-panel',
  standalone: true,
  templateUrl: './google-map-layer-panel.component.html',
  styleUrl: './google-map-layer-panel.component.scss'
})
export class GoogleMapLayerPanelComponent {
  private readonly i18nService = inject(I18nService);

  @Input({ required: true }) layerOptions: GoogleMapLayerOption[] = [];
  @Input({ required: true }) mapVisualStyleOptions: GoogleMapVisualStyleOption[] = [];
  @Input({ required: true }) selectedMapVisualStyle: GoogleMapVisualStyleId = 'hybrid';
  @Input({ required: true }) selectedLanguage: SupportedLanguage = 'en';
  @Input({ required: true }) isLayerEnabled: (id: GoogleMapLayerId) => boolean = () => false;
  @Output() readonly layerToggle = new EventEmitter<LayerToggleEvent>();
  @Output() readonly mapVisualStyleChange = new EventEmitter<GoogleMapVisualStyleId>();

  t(id: TranslationKey): string {
    return this.i18nService.get(id, this.selectedLanguage);
  }

  onLayerToggleChange(id: GoogleMapLayerId, event: Event): void {
    const checked = (event.target as HTMLInputElement | null)?.checked === true;
    this.layerToggle.emit({ id, checked });
  }

  onMapVisualStyleOptionChange(styleId: GoogleMapVisualStyleId): void {
    this.mapVisualStyleChange.emit(styleId);
  }
}
