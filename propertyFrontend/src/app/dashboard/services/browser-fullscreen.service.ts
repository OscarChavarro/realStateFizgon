import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class BrowserFullscreenService {
  async toggleFullscreen(): Promise<void> {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    const rootElement = document.documentElement;
    if (rootElement.requestFullscreen) {
      await rootElement.requestFullscreen();
    }
  }
}
