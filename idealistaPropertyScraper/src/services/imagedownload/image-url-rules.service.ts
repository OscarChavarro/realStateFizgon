import { Injectable } from '@nestjs/common';

@Injectable()
export class ImageUrlRulesService {
  shouldTrackImageUrl(rawUrl: string): boolean {
    if (!this.isIdealistaDomain(rawUrl)) {
      return false;
    }
    if (!this.isBlurImageUrl(rawUrl)) {
      return false;
    }

    const url = rawUrl.toLowerCase();
    if (url.includes('/loading.gif') || url.includes('/loading-mobile.gif')) {
      return false;
    }

    return true;
  }

  isIdealistaDomain(rawUrl: string): boolean {
    try {
      const hostname = new URL(rawUrl).hostname.toLowerCase();
      return hostname === 'idealista.com' || hostname.endsWith('.idealista.com');
    } catch {
      return false;
    }
  }

  isSvgImage(url: string, mimeType: string): boolean {
    if (mimeType.toLowerCase().includes('image/svg+xml')) {
      return true;
    }

    const pathname = this.safeUrlPathname(url).toLowerCase();
    return pathname.endsWith('.svg');
  }

  safeUrlPathname(rawUrl: string): string {
    try {
      return new URL(rawUrl).pathname;
    } catch {
      return '';
    }
  }

  extractPropertyIdFromUrl(url: string): string | null {
    const match = url.match(/\/inmueble\/(\d+)\//i);
    return match?.[1] ?? null;
  }

  extractCanonicalImageKey(rawUrl: string): string | null {
    try {
      const url = new URL(rawUrl);
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length === 0) {
        return null;
      }

      const last = parts[parts.length - 1] ?? '';
      const baseNoExt = last.includes('.') ? last.slice(0, last.lastIndexOf('.')) : last;
      if (!baseNoExt) {
        return null;
      }

      if (parts.length >= 4) {
        const p1 = parts[parts.length - 4];
        const p2 = parts[parts.length - 3];
        const p3 = parts[parts.length - 2];
        return `${p1}/${p2}/${p3}/${baseNoExt}`.toLowerCase();
      }

      return baseNoExt.toLowerCase();
    } catch {
      return null;
    }
  }

  private isBlurImageUrl(rawUrl: string): boolean {
    try {
      const url = new URL(rawUrl);
      return url.pathname.toLowerCase().includes('/blur/');
    } catch {
      return false;
    }
  }
}
