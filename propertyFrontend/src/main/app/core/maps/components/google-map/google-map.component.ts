import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  inject
} from '@angular/core';
import { I18nService, SupportedLanguage, TranslationKey } from 'src/app/core/i18n/services/i18n.service';
import {
  GoogleMapLayerId,
  GoogleMapVisualStyleId,
  GoogleMapVisualStyleOption
} from 'src/app/core/maps/model/google-map-layers.model';
import { GoogleMapProperty } from 'src/app/core/maps/model/google-map-property.model';
import { GoogleMapLike as PoiGoogleMapLike, GoogleMapPoiLayerManager } from 'src/app/core/maps/services/google-map-poi-layer-manager';

type GoogleLatLngLike = {
  lat: () => number;
  lng: () => number;
};

type GoogleMapWithCenter = PoiGoogleMapLike & {
  getCenter: () => GoogleLatLngLike | { lat: number; lng: number } | null;
};

type GoogleMarkerLike = {
  setMap: (map: GoogleMapWithCenter | null) => void;
};

type GoogleMapsApi = {
  Map: new (container: HTMLElement, options: unknown) => GoogleMapWithCenter;
  Marker: new (options: unknown) => GoogleMarkerLike;
  Size: new (width: number, height: number) => unknown;
  Point: new (x: number, y: number) => unknown;
  event?: {
    trigger: (instance: unknown, eventName: string) => void;
  };
};

@Component({
  selector: 'app-google-map',
  standalone: true,
  templateUrl: './google-map.component.html',
  styleUrl: './google-map.component.scss'
})
export class GoogleMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  private static googleMapsScriptPromise: Promise<void> | null = null;

  private readonly i18nService = inject(I18nService);
  private readonly poiLayerManager = new GoogleMapPoiLayerManager();
  private mapInstance: GoogleMapWithCenter | null = null;
  private propertyMarkerInstances: GoogleMarkerLike[] = [];
  private mapRenderSignature: string | null = null;
  private propertiesRenderSignature: string | null = null;
  private isResizingLayerPanel = false;
  private layerPanelStartX = 0;
  private layerPanelStartWidth = 0;
  private readonly onLayerPanelResizeMove = (event: MouseEvent): void => {
    if (!this.isResizingLayerPanel || !this.mapLayoutRef) {
      return;
    }

    const layoutRect = this.mapLayoutRef.nativeElement.getBoundingClientRect();
    const deltaX = event.clientX - this.layerPanelStartX;
    const maxPanelWidth = Math.max(220, layoutRect.width - 320);
    const nextWidth = this.layerPanelStartWidth + deltaX;
    this.layerPanelWidthPx = Math.min(Math.max(nextWidth, 180), maxPanelWidth);
    this.refreshMapViewport();
  };
  private readonly onLayerPanelResizeEnd = (): void => {
    this.stopLayerPanelResize();
  };

  @Input() properties: GoogleMapProperty[] = [];
  @Input() googleMapsApiKey: string | null = null;
  @Input() googleMapsMapId: string | null = null;
  @Input() selectedLanguage: SupportedLanguage = 'en';
  @Input() zoom = 14;
  @Input() preserveViewportOnPropertiesChange = false;

  @ViewChild('mapLayout') private mapLayoutRef?: ElementRef<HTMLDivElement>;
  @ViewChild('mapContainer') private mapContainerRef?: ElementRef<HTMLDivElement>;

  mapLoadError: string | null = null;
  isLayerPanelVisible = true;
  layerPanelWidthPx = 220;
  readonly layerOptions = this.poiLayerManager.layerOptions;
  readonly mapVisualStyleOptions: GoogleMapVisualStyleOption[] = [
    { id: 'vector', label: 'PROPERTY_LOCATION_STYLE_VECTOR' },
    { id: 'satellite', label: 'PROPERTY_LOCATION_STYLE_SATELLITE' },
    { id: 'hybrid', label: 'PROPERTY_LOCATION_STYLE_HYBRID' }
  ];
  selectedMapVisualStyle: GoogleMapVisualStyleId = 'hybrid';

  t(id: TranslationKey): string {
    return this.i18nService.get(id, this.selectedLanguage);
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      void this.initializeMapIfReady();
    }, 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['properties']
      || changes['googleMapsApiKey']
      || changes['googleMapsMapId']
      || changes['zoom']
      || changes['preserveViewportOnPropertiesChange']
    ) {
      setTimeout(() => {
        void this.initializeMapIfReady();
      }, 0);
    }
  }

  ngOnDestroy(): void {
    this.detachLayerPanelResizeListeners();
    this.clearPropertyMarkers();
    this.mapInstance = null;
    this.mapRenderSignature = null;
    this.isResizingLayerPanel = false;
  }

  isLayerEnabled(id: GoogleMapLayerId): boolean {
    return this.poiLayerManager.isLayerEnabled(id);
  }

  isLayerPanelOpen(): boolean {
    return this.isLayerPanelVisible;
  }

  showLayerPanel(): void {
    this.setLayerPanelVisibility(true);
  }

  hideLayerPanel(): void {
    this.setLayerPanelVisibility(false);
  }

  toggleLayerPanelVisibility(): void {
    this.setLayerPanelVisibility(!this.isLayerPanelVisible);
  }

  setLayerPanelVisibility(visible: boolean): void {
    if (this.isLayerPanelVisible === visible) {
      return;
    }

    this.isLayerPanelVisible = visible;
    this.stopLayerPanelResize();
    setTimeout(() => this.refreshMapViewport(), 0);
    setTimeout(() => this.refreshMapViewport(), 75);
  }

  onLayerPanelSplitterMouseDown(event: MouseEvent): void {
    if (!this.isLayerPanelVisible) {
      return;
    }

    this.isResizingLayerPanel = true;
    this.layerPanelStartX = event.clientX;
    this.layerPanelStartWidth = this.layerPanelWidthPx;
    this.attachLayerPanelResizeListeners();
    event.preventDefault();
  }

  onLayerToggle(id: GoogleMapLayerId, event: Event): void {
    const checked = (event.target as HTMLInputElement | null)?.checked === true;
    this.poiLayerManager.toggleLayer(id, checked, this.buildPoiLayerContext());
  }

  onMapVisualStyleChange(styleId: GoogleMapVisualStyleId): void {
    this.selectedMapVisualStyle = styleId;
    this.applyMapVisualStyle();
  }

  private async initializeMapIfReady(): Promise<void> {
    if (!this.mapContainerRef) {
      return;
    }

    const mappableProperties = this.getMappableProperties();
    if (!mappableProperties.length) {
      this.mapLoadError = this.t('PROPERTY_LOCATION_MAP_MISSING_COORDINATES');
      this.mapRenderSignature = null;
      this.propertiesRenderSignature = null;
      this.clearPropertyMarkers();
      return;
    }

    if (!this.googleMapsApiKey) {
      this.mapLoadError = this.t('PROPERTY_LOCATION_MAP_NOT_CONFIGURED');
      this.mapRenderSignature = null;
      this.propertiesRenderSignature = null;
      return;
    }

    const configSignature = this.buildConfigSignature();
    const propertiesSignature = this.buildPropertiesSignature(mappableProperties);
    if (this.mapInstance && this.mapRenderSignature === configSignature) {
      if (this.propertiesRenderSignature === propertiesSignature) {
        return;
      }

      const googleMaps = this.getGoogleMaps();
      if (!googleMaps) {
        this.mapLoadError = this.t('PROPERTY_LOCATION_MAP_LOAD_ERROR');
        return;
      }

      this.mapLoadError = null;
      this.renderMarkers(mappableProperties, googleMaps);
      if (!this.preserveViewportOnPropertiesChange) {
        this.applyViewportToMap(this.resolveViewport(mappableProperties));
      }
      this.propertiesRenderSignature = propertiesSignature;
      return;
    }

    try {
      await this.loadGoogleMapsScript(this.googleMapsApiKey);
      await this.waitForGoogleMapsReady();
      await this.renderMap(mappableProperties);
      this.mapRenderSignature = configSignature;
      this.propertiesRenderSignature = propertiesSignature;
    } catch (error) {
      console.error('[GoogleMapComponent] Google Maps initialization failed.', error);
      this.mapLoadError = this.t('PROPERTY_LOCATION_MAP_LOAD_ERROR');
      this.mapRenderSignature = null;
      this.propertiesRenderSignature = null;
    }
  }

  private getMappableProperties(): GoogleMapProperty[] {
    return this.properties.filter((property) => (
      Number.isFinite(property.latitude)
      && Number.isFinite(property.longitude)
    ));
  }

  private loadGoogleMapsScript(apiKey: string): Promise<void> {
    const googleMaps = this.getGoogleMaps();
    if (googleMaps) {
      return Promise.resolve();
    }

    if (GoogleMapComponent.googleMapsScriptPromise) {
      return GoogleMapComponent.googleMapsScriptPromise;
    }

    GoogleMapComponent.googleMapsScriptPromise = new Promise<void>((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>('script[data-google-maps-api="true"]');
      if (existingScript) {
        if (this.getGoogleMaps()) {
          resolve();
          return;
        }

        existingScript.addEventListener('load', () => resolve(), { once: true });
        existingScript.addEventListener('error', (event) => reject(new Error(`Failed loading Google Maps script: ${String(event)}`)), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
      script.async = true;
      script.defer = true;
      script.dataset['googleMapsApi'] = 'true';
      script.onload = () => resolve();
      script.onerror = (event) => reject(new Error(`Failed loading Google Maps script: ${String(event)}`));
      document.head.appendChild(script);
    }).catch((error: unknown) => {
      GoogleMapComponent.googleMapsScriptPromise = null;
      throw error;
    });

    return GoogleMapComponent.googleMapsScriptPromise;
  }

  private async waitForGoogleMapsReady(timeoutMs = 5000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (this.getGoogleMaps()) {
        return;
      }
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 50);
      });
    }

    throw new Error('Google Maps namespace did not become available after script load.');
  }

  private async renderMap(properties: GoogleMapProperty[]): Promise<void> {
    const googleMaps = this.getGoogleMaps();
    const mapContainer = this.mapContainerRef?.nativeElement;
    if (!googleMaps || !mapContainer) {
      this.mapLoadError = this.t('PROPERTY_LOCATION_MAP_LOAD_ERROR');
      return;
    }

    this.mapLoadError = null;
    const viewport = this.resolveViewport(properties);
    const mapOptions: Record<string, unknown> = {
      center: viewport.center,
      zoom: viewport.zoom,
      mapTypeId: this.resolveMapTypeId(this.selectedMapVisualStyle),
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      keyboardShortcuts: false,
      styles: this.poiLayerManager.buildMapStyles()
    };
    if (this.googleMapsMapId) {
      mapOptions['mapId'] = this.googleMapsMapId;
    }

    this.mapInstance = new googleMaps.Map(mapContainer, mapOptions);
    this.renderMarkers(properties, googleMaps);
    this.poiLayerManager.onMapReady(this.buildPoiLayerContext());
  }

  private renderMarkers(properties: GoogleMapProperty[], googleMaps: GoogleMapsApi): void {
    if (!this.mapInstance) {
      return;
    }

    this.clearPropertyMarkers();
    this.propertyMarkerInstances = properties.map((property) => new googleMaps.Marker({
      map: this.mapInstance,
      position: { lat: property.latitude, lng: property.longitude },
      title: property.title,
      icon: {
        url: this.buildHouseMarkerIconDataUrl(property.unavailable === true),
        scaledSize: new googleMaps.Size(38, 38),
        anchor: new googleMaps.Point(19, 19)
      }
    }));
  }

  private applyViewportToMap(viewport: { center: { lat: number; lng: number }; zoom: number }): void {
    if (!this.mapInstance) {
      return;
    }

    this.mapInstance.setOptions({
      center: viewport.center,
      zoom: viewport.zoom
    });
  }

  private resolveViewport(properties: GoogleMapProperty[]): { center: { lat: number; lng: number }; zoom: number } {
    if (properties.length <= 1) {
      return {
        center: { lat: properties[0].latitude, lng: properties[0].longitude },
        zoom: this.zoom
      };
    }

    let minLat = Number.POSITIVE_INFINITY;
    let maxLat = Number.NEGATIVE_INFINITY;
    let minLng = Number.POSITIVE_INFINITY;
    let maxLng = Number.NEGATIVE_INFINITY;

    for (const property of properties) {
      minLat = Math.min(minLat, property.latitude);
      maxLat = Math.max(maxLat, property.latitude);
      minLng = Math.min(minLng, property.longitude);
      maxLng = Math.max(maxLng, property.longitude);
    }

    return {
      center: {
        lat: (minLat + maxLat) / 2,
        lng: (minLng + maxLng) / 2
      },
      zoom: 10
    };
  }

  private buildConfigSignature(): string {
    return [
      this.googleMapsApiKey ?? '',
      this.googleMapsMapId ?? '',
      String(this.zoom)
    ].join('::');
  }

  private buildPropertiesSignature(properties: GoogleMapProperty[]): string {
    return properties
      .map((property) => (
        `${property.id}:${property.latitude}:${property.longitude}:${property.title}:${property.unavailable === true ? 'closed' : 'open'}`
      ))
      .join('|');
  }

  private attachLayerPanelResizeListeners(): void {
    document.addEventListener('mousemove', this.onLayerPanelResizeMove);
    document.addEventListener('mouseup', this.onLayerPanelResizeEnd);
  }

  private detachLayerPanelResizeListeners(): void {
    document.removeEventListener('mousemove', this.onLayerPanelResizeMove);
    document.removeEventListener('mouseup', this.onLayerPanelResizeEnd);
  }

  private stopLayerPanelResize(): void {
    this.isResizingLayerPanel = false;
    this.detachLayerPanelResizeListeners();
  }

  private clearPropertyMarkers(): void {
    for (const marker of this.propertyMarkerInstances) {
      marker.setMap(null);
    }
    this.propertyMarkerInstances = [];
  }

  private buildHouseMarkerIconDataUrl(isUnavailable: boolean): string {
    const baseColor = isUnavailable ? '#d44343' : '#20a24a';
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38">
        <circle cx="19" cy="19" r="18" fill="${baseColor}"/>
        <path fill="#ffffff" d="M8.5 17.5 19 9l10.5 8.5-1.9 2.3-1.6-1.3V29h-5.8v-6.6h-2.4V29H12V18.5l-1.6 1.3-1.9-2.3z"/>
        <rect x="17" y="23" width="4" height="6" fill="${baseColor}"/>
        <rect x="13.8" y="18.4" width="3.2" height="3" fill="${baseColor}"/>
        <rect x="21" y="18.4" width="3.2" height="3" fill="${baseColor}"/>
      </svg>
    `.trim();
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  private getMapCenter(): { lat: number; lng: number } | null {
    if (!this.mapInstance) {
      return null;
    }

    const center = this.mapInstance.getCenter();
    const lat = this.readLatLng(center, 'lat');
    const lng = this.readLatLng(center, 'lng');
    if (lat === null || lng === null) {
      return null;
    }

    return { lat, lng };
  }

  private readLatLng(
    source: GoogleLatLngLike | { lat: number; lng: number } | null | undefined,
    axis: 'lat' | 'lng'
  ): number | null {
    if (!source) {
      return null;
    }

    const value = source[axis];
    const numeric = typeof value === 'function' ? value() : value;
    return Number.isFinite(numeric) ? numeric : null;
  }

  private refreshMapViewport(): void {
    if (!this.mapInstance) {
      return;
    }

    const center = this.getMapCenter();
    const googleMaps = this.getGoogleMaps();
    if (googleMaps?.event) {
      googleMaps.event.trigger(this.mapInstance, 'resize');
    }

    if (center) {
      this.mapInstance.setOptions({ center });
    }
  }

  private applyMapVisualStyle(): void {
    if (!this.mapInstance) {
      return;
    }

    this.mapInstance.setOptions({
      mapTypeId: this.resolveMapTypeId(this.selectedMapVisualStyle)
    });
  }

  private resolveMapTypeId(style: GoogleMapVisualStyleId): 'roadmap' | 'satellite' | 'hybrid' {
    switch (style) {
      case 'satellite':
        return 'satellite';
      case 'hybrid':
        return 'hybrid';
      default:
        return 'roadmap';
    }
  }

  private buildPoiLayerContext() {
    return {
      mapInstance: this.mapInstance
    };
  }

  private getGoogleMaps(): GoogleMapsApi | null {
    const globalWindow = window as Window & { google?: { maps?: unknown } };
    if (!globalWindow.google || !globalWindow.google.maps) {
      return null;
    }

    return globalWindow.google.maps as GoogleMapsApi;
  }
}
