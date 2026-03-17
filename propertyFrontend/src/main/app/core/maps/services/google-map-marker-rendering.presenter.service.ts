import { Injectable } from '@angular/core';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import {
  GoogleMapWithCenter,
  GoogleMarkerLike,
  GoogleMapsApi
} from 'src/app/core/maps/model/google-maps-runtime.types';
import { GoogleMapProperty } from 'src/app/core/maps/model/google-map-property.model';
import { GoogleMapMarkerIconFactory } from 'src/app/core/maps/services/google-map-marker-icon-factory';

type RenderPropertyMarkersInput = {
  mapInstance: GoogleMapWithCenter;
  properties: GoogleMapProperty[];
  googleMaps: GoogleMapsApi;
  interactionEnabled: boolean;
  markerIconFactory: GoogleMapMarkerIconFactory;
  onMarkerClick: (property: GoogleMapProperty) => void;
};

type RenderPropertyMarkersResult = {
  propertyMarkerInstances: GoogleMarkerLike[];
  markerClusterer: MarkerClusterer;
};

type SelectedTargetMarkerInput = {
  mapInstance: GoogleMapWithCenter;
  selectedProperty: GoogleMapProperty;
  googleMaps: GoogleMapsApi;
  markerIconFactory: GoogleMapMarkerIconFactory;
};

@Injectable({
  providedIn: 'root'
})
export class GoogleMapMarkerRenderingPresenterService {
  renderPropertyMarkers(input: RenderPropertyMarkersInput): RenderPropertyMarkersResult {
    const propertyMarkerInstances = input.properties.map((property) => {
      const marker = new input.googleMaps.Marker({
        position: { lat: property.latitude, lng: property.longitude },
        title: property.title,
        icon: {
          url: input.markerIconFactory.buildPropertyMarkerIconDataUrl(property),
          scaledSize: new input.googleMaps.Size(38, 38),
          anchor: new input.googleMaps.Point(19, 19)
        }
      });

      if (input.interactionEnabled && typeof marker.addListener === 'function') {
        marker.addListener('click', () => {
          input.onMarkerClick(property);
        });
      }

      return marker;
    });

    const markerClusterer = new MarkerClusterer({
      map: input.mapInstance as unknown as never,
      markers: propertyMarkerInstances as unknown as never[]
    });

    return {
      propertyMarkerInstances,
      markerClusterer
    };
  }

  createSelectedTargetMarker(input: SelectedTargetMarkerInput): GoogleMarkerLike {
    return new input.googleMaps.Marker({
      map: input.mapInstance,
      position: {
        lat: input.selectedProperty.latitude,
        lng: input.selectedProperty.longitude
      },
      zIndex: 3000,
      icon: {
        url: input.markerIconFactory.buildSelectedTargetMarkerIconDataUrl(),
        scaledSize: new input.googleMaps.Size(56, 56),
        anchor: new input.googleMaps.Point(28, 28)
      }
    });
  }
}
