import { AfterViewInit, Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges, ViewChild, inject } from '@angular/core';
import { I18nService, SupportedLanguage, TranslationKey } from 'src/app/i18n/i18n.service';
import {
  GoogleLatLngLike,
  GoogleMapLike as PoiGoogleMapLike,
  GoogleMarkerLike as PoiGoogleMarkerLike,
  GooglePlacesServiceLike,
  LocationLayerId,
  PropertyLocationPoiLayerManager
} from './property-location-poi-layer-manager';

type GoogleMapWithCenter = PoiGoogleMapLike & {
  getCenter: () => GoogleLatLngLike | { lat: number; lng: number } | null;
};

type GoogleMapsApi = {
  Map: new (container: HTMLElement, options: unknown) => GoogleMapWithCenter;
  Marker: new (options: unknown) => PoiGoogleMarkerLike;
  Size: new (width: number, height: number) => unknown;
  Point: new (x: number, y: number) => unknown;
  places?: {
    PlacesService: new (map: GoogleMapWithCenter) => GooglePlacesServiceLike;
    PlacesServiceStatus: {
      OK: string;
    };
  };
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
  private placesService: GooglePlacesServiceLike | null = null;
  private isResizingLayerPanel = false;
  private layerPanelStartX = 0;
  private layerPanelStartWidth = 0;

  @Input() isOpen = false;
  @Input() propertyTitle = '';
  @Input() latitude: number | null = null;
  @Input() longitude: number | null = null;
  @Input() googleMapsApiKey: string | null = null;
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
      this.renderMap();
    } catch {
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
        existingScript.addEventListener('load', () => resolve(), { once: true });
        existingScript.addEventListener('error', () => reject(new Error('Failed loading Google Maps script.')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.dataset['googleMapsApi'] = 'true';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed loading Google Maps script.'));
      document.head.appendChild(script);
    });

    return PropertyLocationComponent.googleMapsScriptPromise;
  }

  private renderMap(): void {
    const googleMaps = this.getGoogleMaps();
    const mapContainer = this.mapContainerRef?.nativeElement;
    if (!googleMaps || !mapContainer || this.latitude === null || this.longitude === null) {
      this.mapLoadError = this.t('PROPERTY_LOCATION_MAP_LOAD_ERROR');
      return;
    }

    this.mapLoadError = null;
    const center = { lat: this.latitude, lng: this.longitude };
    this.mapInstance = new googleMaps.Map(mapContainer, {
      center,
      zoom: 14,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      keyboardShortcuts: false,
      styles: this.poiLayerManager.buildMapStyles()
    });

    if (this.markerInstance) {
      this.markerInstance.setMap(null);
    }

    this.markerInstance = new googleMaps.Marker({
      map: this.mapInstance,
      position: center,
      title: this.propertyTitle,
      icon: {
        url: this.buildHouseMarkerIconDataUrl(),
        scaledSize: new googleMaps.Size(38, 38),
        anchor: new googleMaps.Point(19, 19)
      }
    });

    this.placesService = googleMaps.places
      ? new googleMaps.places.PlacesService(this.mapInstance)
      : null;

    this.poiLayerManager.onMapReady(this.buildPoiLayerContext());
  }

  private buildHouseMarkerIconDataUrl(): string {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38">
        <circle cx="19" cy="19" r="18" fill="#20a24a"/>
        <path fill="#ffffff" d="M8.5 17.5 19 9l10.5 8.5-1.9 2.3-1.6-1.3V29h-5.8v-6.6h-2.4V29H12V18.5l-1.6 1.3-1.9-2.3z"/>
        <rect x="17" y="23" width="4" height="6" fill="#20a24a"/>
        <rect x="13.8" y="18.4" width="3.2" height="3" fill="#20a24a"/>
        <rect x="21" y="18.4" width="3.2" height="3" fill="#20a24a"/>
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
    const center = this.getMapCenter();
    if (!this.mapInstance || !center) {
      return;
    }

    this.mapInstance.setOptions({ center });
  }

  private buildPoiLayerContext() {
    return {
      mapInstance: this.mapInstance,
      placesService: this.placesService,
      mapsApi: this.getGoogleMaps(),
      getMapCenter: () => this.getMapCenter()
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
