import { Injectable } from '@angular/core';
import { GoogleMapVisualStyleId } from 'src/app/core/maps/model/google-map-layers.model';
import { GoogleMapProperty } from 'src/app/core/maps/model/google-map-property.model';

type BuildMapOptionsParams = {
  viewport: {
    center: { lat: number; lng: number };
    zoom: number;
  };
  selectedMapVisualStyle: GoogleMapVisualStyleId;
  styles: Array<Record<string, unknown>>;
  googleMapsMapId: string | null;
};

@Injectable({
  providedIn: 'root'
})
export class GoogleMapRenderUseCaseService {
  getMappableProperties(properties: GoogleMapProperty[]): GoogleMapProperty[] {
    return properties.filter(
      (property) => Number.isFinite(property.latitude) && Number.isFinite(property.longitude)
    );
  }

  buildConfigSignature(apiKey: string | null, mapId: string | null, zoom: number): string {
    return [apiKey ?? '', mapId ?? '', String(zoom)].join('::');
  }

  buildPropertiesSignature(properties: GoogleMapProperty[]): string {
    return properties
      .map(
        (property) =>
          `${property.id}:${property.latitude}:${property.longitude}:${property.title}:${property.closed === true ? 'closed' : 'open'}:${property.review ?? 'NEW'}`
      )
      .join('|');
  }

  resolveMapTypeId(style: GoogleMapVisualStyleId): 'roadmap' | 'satellite' | 'hybrid' {
    switch (style) {
      case 'satellite':
        return 'satellite';
      case 'hybrid':
        return 'hybrid';
      default:
        return 'roadmap';
    }
  }

  buildMapOptions(params: BuildMapOptionsParams): Record<string, unknown> {
    const mapOptions: Record<string, unknown> = {
      center: params.viewport.center,
      zoom: params.viewport.zoom,
      mapTypeId: this.resolveMapTypeId(params.selectedMapVisualStyle),
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      keyboardShortcuts: false,
      styles: params.styles
    };

    if (params.googleMapsMapId) {
      mapOptions['mapId'] = params.googleMapsMapId;
    }

    return mapOptions;
  }
}
