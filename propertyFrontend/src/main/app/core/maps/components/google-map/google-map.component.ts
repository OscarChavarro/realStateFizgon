import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  NgZone,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  inject
} from '@angular/core';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import {
  I18nService,
  SupportedLanguage,
  TranslationKey
} from 'src/app/core/i18n/services/i18n.service';
import {
  GoogleMapLayerId,
  GoogleMapVisualStyleId,
  GoogleMapVisualStyleOption
} from 'src/app/core/maps/model/google-map-layers.model';
import { PropertyMiniSummaryComponent } from 'src/app/core/maps/components/property-mini-summary/property-mini-summary.component';
import { GoogleMapProperty } from 'src/app/core/maps/model/google-map-property.model';
import { GoogleMapPoiLayerManager } from 'src/app/core/maps/services/google-map-poi-layer-manager';
import {
  GoogleMapsApi,
  GoogleMarkerLike,
  GoogleMapWithCenter
} from 'src/app/core/maps/model/google-maps-runtime.types';
import { GoogleMapsRuntimeLoader } from 'src/app/core/maps/services/google-maps-runtime-loader';
import { GoogleMapViewportManager } from 'src/app/core/maps/services/google-map-viewport-manager';
import { GoogleMapMarkerIconFactory } from 'src/app/core/maps/services/google-map-marker-icon-factory';
import {
  GoogleMapKeyboardSelectionResult,
  GoogleMapSelectionController
} from 'src/app/core/maps/services/google-map-selection-controller';

@Component({
  selector: 'app-google-map',
  standalone: true,
  imports: [PropertyMiniSummaryComponent],
  templateUrl: './google-map.component.html',
  styleUrl: './google-map.component.scss'
})
export class GoogleMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly i18nService = inject(I18nService);
  private readonly ngZone = inject(NgZone);
  private readonly runtimeLoader = new GoogleMapsRuntimeLoader();
  private readonly viewportManager = new GoogleMapViewportManager();
  private readonly markerIconFactory = new GoogleMapMarkerIconFactory();
  private readonly selectionController = new GoogleMapSelectionController();
  private readonly poiLayerManager = new GoogleMapPoiLayerManager();
  private mapInstance: GoogleMapWithCenter | null = null;
  private markerClusterer: MarkerClusterer | null = null;
  private propertyMarkerInstances: GoogleMarkerLike[] = [];
  private selectedTargetMarker: GoogleMarkerLike | null = null;
  private markerInteractionEnabledSnapshot: boolean | null = null;
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
  @Input() interactionEnabled = true;

  @ViewChild('mapLayout') private mapLayoutRef?: ElementRef<HTMLDivElement>;
  @ViewChild('mapContainer') private mapContainerRef?: ElementRef<HTMLDivElement>;
  @ViewChild('miniSummaryContainer') private miniSummaryContainerRef?: ElementRef<HTMLDivElement>;

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

  get selectedPropertySummary(): GoogleMapProperty | null {
    return this.selectionController.getSelectedPropertySummary();
  }

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
      changes['properties'] ||
      changes['googleMapsApiKey'] ||
      changes['googleMapsMapId'] ||
      changes['zoom'] ||
      changes['preserveViewportOnPropertiesChange'] ||
      changes['interactionEnabled']
    ) {
      setTimeout(() => {
        void this.initializeMapIfReady();
      }, 0);
    }

    if (changes['interactionEnabled'] && !this.interactionEnabled) {
      this.clearSelectionState();
      this.cdr.markForCheck();
    }
  }

  ngOnDestroy(): void {
    this.detachLayerPanelResizeListeners();
    this.clearMarkerClusterer();
    this.clearPropertyMarkers();
    this.clearSelectedTargetMarker();
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
      this.markerInteractionEnabledSnapshot = null;
      this.selectionController.clearSelection();
      this.clearPropertyMarkers();
      this.clearSelectedTargetMarker();
      return;
    }

    if (!this.googleMapsApiKey) {
      this.mapLoadError = this.t('PROPERTY_LOCATION_MAP_NOT_CONFIGURED');
      this.mapRenderSignature = null;
      this.propertiesRenderSignature = null;
      this.markerInteractionEnabledSnapshot = null;
      this.selectionController.clearSelection();
      this.clearSelectedTargetMarker();
      return;
    }

    const configSignature = this.buildConfigSignature();
    const propertiesSignature = this.buildPropertiesSignature(mappableProperties);
    if (this.mapInstance && this.mapRenderSignature === configSignature) {
      const interactionChanged = this.markerInteractionEnabledSnapshot !== this.interactionEnabled;
      if (this.propertiesRenderSignature === propertiesSignature) {
        if (interactionChanged) {
          const googleMaps = this.runtimeLoader.getGoogleMaps();
          if (!googleMaps) {
            this.mapLoadError = this.t('PROPERTY_LOCATION_MAP_LOAD_ERROR');
            return;
          }

          this.renderMarkers(mappableProperties, googleMaps);
          if (!this.interactionEnabled) {
            this.clearSelectionState();
          } else {
            this.syncSelectedSummaryAgainstProperties(mappableProperties);
          }
        }
        return;
      }

      const googleMaps = this.runtimeLoader.getGoogleMaps();
      if (!googleMaps) {
        this.mapLoadError = this.t('PROPERTY_LOCATION_MAP_LOAD_ERROR');
        return;
      }

      this.mapLoadError = null;
      this.renderMarkers(mappableProperties, googleMaps);
      if (!this.preserveViewportOnPropertiesChange) {
        this.applyViewportToMap(
          this.viewportManager.resolveViewport(mappableProperties, this.zoom)
        );
      }
      if (!this.interactionEnabled) {
        this.clearSelectionState();
      } else {
        this.syncSelectedSummaryAgainstProperties(mappableProperties);
      }
      this.propertiesRenderSignature = propertiesSignature;
      return;
    }

    try {
      await this.runtimeLoader.loadGoogleMapsScript(this.googleMapsApiKey);
      await this.runtimeLoader.waitForGoogleMapsReady();
      await this.renderMap(mappableProperties);
      this.mapRenderSignature = configSignature;
      this.propertiesRenderSignature = propertiesSignature;
      if (!this.interactionEnabled) {
        this.clearSelectionState();
      } else {
        this.syncSelectedSummaryAgainstProperties(mappableProperties);
      }
    } catch (error) {
      console.error('[GoogleMapComponent] Google Maps initialization failed.', error);
      this.mapLoadError = this.t('PROPERTY_LOCATION_MAP_LOAD_ERROR');
      this.mapRenderSignature = null;
      this.propertiesRenderSignature = null;
      this.markerInteractionEnabledSnapshot = null;
      this.selectionController.clearSelection();
      this.clearSelectedTargetMarker();
    }
  }

  private getMappableProperties(): GoogleMapProperty[] {
    return this.properties.filter(
      (property) => Number.isFinite(property.latitude) && Number.isFinite(property.longitude)
    );
  }

  private async renderMap(properties: GoogleMapProperty[]): Promise<void> {
    const googleMaps = this.runtimeLoader.getGoogleMaps();
    const mapContainer = this.mapContainerRef?.nativeElement;
    if (!googleMaps || !mapContainer) {
      this.mapLoadError = this.t('PROPERTY_LOCATION_MAP_LOAD_ERROR');
      return;
    }

    this.mapLoadError = null;
    const viewport = this.viewportManager.resolveViewport(properties, this.zoom);
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

    this.clearMarkerClusterer();
    this.clearPropertyMarkers();
    this.propertyMarkerInstances = properties.map((property) => {
      const marker = new googleMaps.Marker({
        position: { lat: property.latitude, lng: property.longitude },
        title: property.title,
        icon: {
          url: this.markerIconFactory.buildPropertyMarkerIconDataUrl(property),
          scaledSize: new googleMaps.Size(38, 38),
          anchor: new googleMaps.Point(19, 19)
        }
      });

      if (this.interactionEnabled && typeof marker.addListener === 'function') {
        marker.addListener('click', () => {
          this.ngZone.run(() => {
            this.openPropertyMiniSummary(property, { focus: true });
          });
        });
      }

      return marker;
    });
    this.markerClusterer = new MarkerClusterer({
      map: this.mapInstance as unknown as never,
      markers: this.propertyMarkerInstances as unknown as never[]
    });
    this.markerInteractionEnabledSnapshot = this.interactionEnabled;
    this.updateSelectedTargetMarker();
  }

  private applyViewportToMap(viewport: {
    center: { lat: number; lng: number };
    zoom: number;
  }): void {
    this.viewportManager.applyViewportToMap(this.mapInstance, viewport);
  }

  private buildConfigSignature(): string {
    return [this.googleMapsApiKey ?? '', this.googleMapsMapId ?? '', String(this.zoom)].join('::');
  }

  private buildPropertiesSignature(properties: GoogleMapProperty[]): string {
    return properties
      .map(
        (property) =>
          `${property.id}:${property.latitude}:${property.longitude}:${property.title}:${property.closed === true ? 'closed' : 'open'}:${property.review ?? 'NEW'}`
      )
      .join('|');
  }

  onPropertyMiniSummaryCloseRequested(): void {
    this.clearSelectionState();
    this.cdr.markForCheck();
  }

  @HostListener('window:keydown', ['$event'])
  onWindowKeyDown(event: KeyboardEvent): void {
    const keyboardResult = this.selectionController.handleKeyboardSelection(
      event,
      this.interactionEnabled,
      this.getMappableProperties()
    );

    this.applyKeyboardSelectionResult(keyboardResult);
  }

  private openPropertyMiniSummary(
    property: GoogleMapProperty,
    options: { focus?: boolean } = {}
  ): void {
    this.selectionController.selectProperty(property);
    this.updateSelectedTargetMarker();
    this.cdr.markForCheck();

    if (options.focus) {
      this.focusMiniSummary();
    }
  }

  private focusMiniSummary(): void {
    requestAnimationFrame(() => {
      const element = this.miniSummaryContainerRef?.nativeElement;
      if (!element) {
        return;
      }

      element.focus({ preventScroll: true });
    });
  }

  private centerMapOnProperty(property: GoogleMapProperty): void {
    this.viewportManager.centerMapOnProperty(this.mapInstance, property);
  }

  private applyKeyboardSelectionResult(result: GoogleMapKeyboardSelectionResult): void {
    if (result.type === 'none') {
      return;
    }

    if (result.type === 'closed') {
      this.clearSelectedTargetMarker();
      this.cdr.markForCheck();
      return;
    }

    this.updateSelectedTargetMarker();
    this.centerMapOnProperty(result.property);
    this.focusMiniSummary();
    this.cdr.markForCheck();
  }

  private syncSelectedSummaryAgainstProperties(mappableProperties: GoogleMapProperty[]): void {
    const selected = this.selectionController.syncSelectionAgainstProperties(mappableProperties);
    if (selected === null) {
      this.clearSelectedTargetMarker();
      return;
    }

    this.updateSelectedTargetMarker();
    this.cdr.markForCheck();
  }

  private updateSelectedTargetMarker(): void {
    if (!this.interactionEnabled || !this.mapInstance || this.selectedPropertySummary === null) {
      this.clearSelectedTargetMarker();
      return;
    }

    const googleMaps = this.runtimeLoader.getGoogleMaps();
    if (!googleMaps) {
      return;
    }

    this.clearSelectedTargetMarker();
    this.selectedTargetMarker = new googleMaps.Marker({
      map: this.mapInstance,
      position: {
        lat: this.selectedPropertySummary.latitude,
        lng: this.selectedPropertySummary.longitude
      },
      zIndex: 3000,
      icon: {
        url: this.markerIconFactory.buildSelectedTargetMarkerIconDataUrl(),
        scaledSize: new googleMaps.Size(56, 56),
        anchor: new googleMaps.Point(28, 28)
      }
    });
  }

  private clearSelectedTargetMarker(): void {
    if (!this.selectedTargetMarker) {
      return;
    }

    this.selectedTargetMarker.setMap(null);
    this.selectedTargetMarker = null;
  }

  private clearSelectionState(): void {
    this.selectionController.clearSelection();
    this.clearSelectedTargetMarker();
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

  private clearMarkerClusterer(): void {
    if (!this.markerClusterer) {
      return;
    }

    this.markerClusterer.clearMarkers();
    this.markerClusterer = null;
  }

  private refreshMapViewport(): void {
    this.viewportManager.refreshMapViewport(this.mapInstance, this.runtimeLoader.getGoogleMaps());
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
}
