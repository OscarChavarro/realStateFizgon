import { Injectable } from '@angular/core';
import { GoogleMapProperty } from 'src/app/core/maps/model/google-map-property.model';
import { GoogleMapKeyboardSelectionResult } from 'src/app/core/maps/services/google-map-selection-controller';
import { GoogleMapWithCenter } from 'src/app/core/maps/model/google-maps-runtime.types';

@Injectable({
  providedIn: 'root'
})
export class GoogleMapSelectionUseCaseService {
  shouldClearSelectedTargetMarker(
    interactionEnabled: boolean,
    mapInstance: GoogleMapWithCenter | null,
    selectedPropertySummary: GoogleMapProperty | null
  ): boolean {
    return !interactionEnabled || !mapInstance || selectedPropertySummary === null;
  }

  isKeyboardSelectionClosed(result: GoogleMapKeyboardSelectionResult): boolean {
    return result.type === 'closed';
  }

  isKeyboardSelectionSelected(
    result: GoogleMapKeyboardSelectionResult
  ): result is Extract<GoogleMapKeyboardSelectionResult, { type: 'selected' }> {
    return result.type === 'selected';
  }
}
