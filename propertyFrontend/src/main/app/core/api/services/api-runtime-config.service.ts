import { Injectable } from '@angular/core';

type RuntimeConfiguration = {
  backendBaseUrl: string;
  staticMediaBaseUrl: string;
};

@Injectable({
  providedIn: 'root'
})
export class ApiRuntimeConfigService {
  static readonly DEFAULT_BACKEND_BASE_URL = 'http://localhost:4200';
  static readonly DEFAULT_STATIC_MEDIA_BASE_URL = 'http://localhost:666/';

  private backendBaseUrl = ApiRuntimeConfigService.DEFAULT_BACKEND_BASE_URL;
  private staticMediaBaseUrl = ApiRuntimeConfigService.DEFAULT_STATIC_MEDIA_BASE_URL;

  setConfiguration(configuration: RuntimeConfiguration): void {
    this.backendBaseUrl = this.normalizeBackendBaseUrl(configuration.backendBaseUrl);
    this.staticMediaBaseUrl = this.normalizeStaticMediaBaseUrl(configuration.staticMediaBaseUrl);
  }

  getBackendBaseUrl(): string {
    return this.backendBaseUrl;
  }

  getStaticMediaBaseUrl(): string {
    return this.staticMediaBaseUrl;
  }

  resolveBackendUrl(pathOrUrl: string): string {
    if (this.isAbsoluteUrl(pathOrUrl)) {
      return pathOrUrl;
    }

    const normalizedPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
    return `${this.backendBaseUrl}${normalizedPath}`;
  }

  shouldRouteToBackend(pathOrUrl: string): boolean {
    if (this.isAbsoluteUrl(pathOrUrl)) {
      return this.isBackendUrl(pathOrUrl);
    }

    const normalizedPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
    if (normalizedPath === '/secrets.json' || normalizedPath.startsWith('/assets/')) {
      return false;
    }

    return (
      normalizedPath.startsWith('/auth/') ||
      normalizedPath.startsWith('/properties') ||
      normalizedPath.startsWith('/removeDanglingImages')
    );
  }

  private normalizeBackendBaseUrl(value: string): string {
    const raw = value.trim();
    if (!raw) {
      return ApiRuntimeConfigService.DEFAULT_BACKEND_BASE_URL;
    }

    return raw.endsWith('/') ? raw.slice(0, -1) : raw;
  }

  private normalizeStaticMediaBaseUrl(value: string): string {
    const raw = value.trim();
    if (!raw) {
      return ApiRuntimeConfigService.DEFAULT_STATIC_MEDIA_BASE_URL;
    }

    return raw.endsWith('/') ? raw : `${raw}/`;
  }

  private isAbsoluteUrl(value: string): boolean {
    return /^https?:\/\//i.test(value);
  }

  private isBackendUrl(value: string): boolean {
    try {
      const backendUrl = new URL(this.backendBaseUrl);
      const requestUrl = new URL(value);
      return backendUrl.origin === requestUrl.origin;
    } catch {
      return false;
    }
  }
}
