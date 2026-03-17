import { Injectable } from '@angular/core';

type LayerPanelResizeInput = {
  isResizingLayerPanel: boolean;
  layoutWidth: number;
  clientX: number;
  layerPanelStartX: number;
  layerPanelStartWidth: number;
};

@Injectable({
  providedIn: 'root'
})
export class GoogleMapLayerPanelUseCaseService {
  shouldStartResize(isLayerPanelVisible: boolean): boolean {
    return isLayerPanelVisible;
  }

  shouldApplyVisibilityChange(currentVisibility: boolean, nextVisibility: boolean): boolean {
    return currentVisibility !== nextVisibility;
  }

  calculateResizedPanelWidth(input: LayerPanelResizeInput): number | null {
    if (!input.isResizingLayerPanel) {
      return null;
    }

    const deltaX = input.clientX - input.layerPanelStartX;
    const maxPanelWidth = Math.max(220, input.layoutWidth - 320);
    const nextWidth = input.layerPanelStartWidth + deltaX;
    return Math.min(Math.max(nextWidth, 180), maxPanelWidth);
  }
}
