import { AfterViewInit, Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges, ViewChild, inject } from '@angular/core';
import { I18nService, SupportedLanguage, TranslationKey } from 'src/app/i18n/i18n.service';
import {
  GoogleLatLngLike,
  GoogleMapLike as PoiGoogleMapLike,
  GoogleMarkerLike as PoiGoogleMarkerLike,
  LocationLayerId,
  PropertyLocationPoiLayerManager
} from './property-location-poi-layer-manager';

type GoogleMapWithCenter = PoiGoogleMapLike & {
  getCenter: () => GoogleLatLngLike | { lat: number; lng: number } | null;
};

type GoogleMapsApi = {
  Map: new (container: HTMLElement, options: unknown) => GoogleMapWithCenter;
  importLibrary?: (libraryName: string) => Promise<unknown>;
};

type MarkerLibraryLike = {
  AdvancedMarkerElement?: new (options: {
    map?: GoogleMapWithCenter | null;
    position: { lat: number; lng: number };
    title?: string;
    content?: HTMLElement;
  }) => PoiGoogleMarkerLike;
};

@Component({
  selector: 'app-property-location',
  standalone: true,
  templateUrl: './property-location.component.html',
  styleUrl: './property-location.component.css'
})
export class PropertyLocationComponent implements AfterViewInit, OnChanges {
  private static googleMapsScriptPromise: Promise<void> | null = null;

  private readonly i18nService = inject(I18nService);
  private readonly poiLayerManager = new PropertyLocationPoiLayerManager();
  private mapInstance: GoogleMapWithCenter | null = null;
  private markerInstance: PoiGoogleMarkerLike | null = null;
  private isResizingLayerPanel = false;
  private layerPanelStartX = 0;
  private layerPanelStartWidth = 0;

  @Input() isOpen = false;
  @Input() propertyTitle = '';
  @Input() latitude: number | null = null;
  @Input() longitude: number | null = null;
  @Input() googleMapsApiKey: string | null = null;
  @Input() googleMapsMapId: string | null = null;
  @Input() selectedLanguage: SupportedLanguage = 'en';
  @Output() readonly closeRequested = new EventEmitter<void>();
  @ViewChild('mapLayout') private mapLayoutRef?: ElementRef<HTMLDivElement>;
  @ViewChild('mapContainer') private mapContainerRef?: ElementRef<HTMLDivElement>;
  mapLoadError: string | null = null;
  isLayerPanelVisible = true;
  layerPanelWidthPx = 220;
  readonly layerOptions = this.poiLayerManager.layerOptions;

  t(id: TranslationKey): string {
    return this.i18nService.get(id, this.selectedLanguage);
  }

  ngAfterViewInit(): void {
    void this.initializeMapIfReady();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['isOpen']
      || changes['latitude']
      || changes['longitude']
      || changes['googleMapsApiKey']
      || changes['googleMapsMapId']
      || changes['propertyTitle']
    ) {
      if (changes['isOpen'] && !this.isOpen) {
        this.isResizingLayerPanel = false;
      }
      setTimeout(() => {
        void this.initializeMapIfReady();
      }, 0);
    }
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

  @HostListener('document:mousemove', ['$event'])
  onDocumentMouseMove(event: MouseEvent): void {
    if (!this.isResizingLayerPanel || !this.mapLayoutRef) {
      return;
    }

    const layoutRect = this.mapLayoutRef.nativeElement.getBoundingClientRect();
    const deltaX = event.clientX - this.layerPanelStartX;
    const maxPanelWidth = Math.max(220, layoutRect.width - 320);
    const nextWidth = this.layerPanelStartWidth + deltaX;
    this.layerPanelWidthPx = Math.min(Math.max(nextWidth, 180), maxPanelWidth);
    this.refreshMapViewport();
  }

  @HostListener('document:mouseup')
  onDocumentMouseUp(): void {
    this.isResizingLayerPanel = false;
  }

  isLayerEnabled(id: LocationLayerId): boolean {
    return this.poiLayerManager.isLayerEnabled(id);
  }

  toggleLayerPanelVisibility(): void {
    this.isLayerPanelVisible = !this.isLayerPanelVisible;
    setTimeout(() => this.refreshMapViewport(), 0);
  }

  onLayerPanelSplitterMouseDown(event: MouseEvent): void {
    if (!this.isLayerPanelVisible) {
      return;
    }

    this.isResizingLayerPanel = true;
    this.layerPanelStartX = event.clientX;
    this.layerPanelStartWidth = this.layerPanelWidthPx;
    event.preventDefault();
  }

  onLayerToggle(id: LocationLayerId, event: Event): void {
    const checked = (event.target as HTMLInputElement | null)?.checked === true;
    this.poiLayerManager.toggleLayer(id, checked, this.buildPoiLayerContext());
  }

  private async initializeMapIfReady(): Promise<void> {
    if (!this.isOpen || !this.mapContainerRef) {
      return;
    }

    if (!Number.isFinite(this.latitude) || !Number.isFinite(this.longitude)) {
      this.mapLoadError = this.t('PROPERTY_LOCATION_MAP_MISSING_COORDINATES');
      return;
    }

    if (!this.googleMapsApiKey) {
      this.mapLoadError = this.t('PROPERTY_LOCATION_MAP_NOT_CONFIGURED');
      return;
    }

    try {
      await this.loadGoogleMapsScript(this.googleMapsApiKey);
      await this.waitForGoogleMapsReady();
      await this.renderMap();
    } catch (error) {
      console.error('[PropertyLocationComponent] Google Maps initialization failed.', error);
      this.mapLoadError = this.t('PROPERTY_LOCATION_MAP_LOAD_ERROR');
    }
  }

  private loadGoogleMapsScript(apiKey: string): Promise<void> {
    const googleMaps = this.getGoogleMaps();
    if (googleMaps) {
      return Promise.resolve();
    }

    if (PropertyLocationComponent.googleMapsScriptPromise) {
      return PropertyLocationComponent.googleMapsScriptPromise;
    }

    PropertyLocationComponent.googleMapsScriptPromise = new Promise<void>((resolve, reject) => {
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
      PropertyLocationComponent.googleMapsScriptPromise = null;
      throw error;
    });

    return PropertyLocationComponent.googleMapsScriptPromise;
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

  private async renderMap(): Promise<void> {
    const googleMaps = this.getGoogleMaps();
    const mapContainer = this.mapContainerRef?.nativeElement;
    if (!googleMaps || !mapContainer || this.latitude === null || this.longitude === null) {
      if (!googleMaps) {
        console.error('[PropertyLocationComponent] renderMap aborted: window.google.maps is unavailable.');
      }
      if (!mapContainer) {
        console.error('[PropertyLocationComponent] renderMap aborted: map container is missing.');
      }
      if (this.latitude === null || this.longitude === null) {
        console.error('[PropertyLocationComponent] renderMap aborted: coordinates are missing.', {
          latitude: this.latitude,
          longitude: this.longitude
        });
      }
      this.mapLoadError = this.t('PROPERTY_LOCATION_MAP_LOAD_ERROR');
      return;
    }

    const markerLibrary = await this.loadMarkerLibrary(googleMaps);
    if (!markerLibrary?.AdvancedMarkerElement) {
      console.error('[PropertyLocationComponent] AdvancedMarkerElement is unavailable.');
      this.mapLoadError = this.t('PROPERTY_LOCATION_MAP_LOAD_ERROR');
      return;
    }

    this.mapLoadError = null;
    const center = { lat: this.latitude, lng: this.longitude };
    this.mapInstance = new googleMaps.Map(mapContainer, {
      center,
      zoom: 14,
      mapId: this.googleMapsMapId ?? 'DEMO_MAP_ID',
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      keyboardShortcuts: false,
      styles: this.poiLayerManager.buildMapStyles()
    });

    if (this.markerInstance) {
      this.setMarkerMap(this.markerInstance, null);
    }

    this.markerInstance = new markerLibrary.AdvancedMarkerElement({
      map: this.mapInstance,
      position: center,
      title: this.propertyTitle,
      content: this.buildHouseMarkerContentElement()
    });

    this.poiLayerManager.onMapReady(this.buildPoiLayerContext());
  }

  private buildHouseMarkerContentElement(): HTMLElement {
    const container = document.createElement('div');
    container.style.width = '38px';
    container.style.height = '38px';
    container.style.borderRadius = '50%';
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.style.background = '#20a24a';
    container.style.color = '#ffffff';
    container.style.fontSize = '18px';
    container.style.lineHeight = '1';
    container.textContent = '🏠';
    return container;
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
    const center = this.getMapCenter();
    if (!this.mapInstance || !center) {
      return;
    }

    this.mapInstance.setOptions({ center });
  }

  private buildPoiLayerContext() {
    return {
      mapInstance: this.mapInstance,
      mapsApi: this.getGoogleMaps(),
      getMapCenter: () => this.getMapCenter()
    };
  }

  private async loadMarkerLibrary(googleMaps: GoogleMapsApi): Promise<MarkerLibraryLike | null> {
    if (!googleMaps.importLibrary) {
      return null;
    }

    const markerLibrary = (await googleMaps.importLibrary('marker')) as MarkerLibraryLike | undefined;
    return markerLibrary ?? null;
  }

  private setMarkerMap(marker: PoiGoogleMarkerLike, map: GoogleMapWithCenter | null): void {
    if (typeof marker.setMap === 'function') {
      marker.setMap(map);
      return;
    }

    marker.map = map;
  }

  private getGoogleMaps(): GoogleMapsApi | null {
    const globalWindow = window as Window & { google?: { maps?: unknown } };
    if (!globalWindow.google || !globalWindow.google.maps) {
      return null;
    }

    return globalWindow.google.maps as GoogleMapsApi;
  }
}
