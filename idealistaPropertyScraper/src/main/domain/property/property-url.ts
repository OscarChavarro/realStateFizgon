export class PropertyUrl {
  static readonly INMUEBLE_PATH_REGEX_SOURCE = '^\\/inmueble\\/(\\d+)(?:\\/|$)';

  private static readonly INMUEBLE_PATH_REGEX = new RegExp(PropertyUrl.INMUEBLE_PATH_REGEX_SOURCE, 'i');
  private static readonly INMUEBLE_ANYWHERE_REGEX = /\/inmueble\/(\d+)(?:\/|$)/i;

  static extractPropertyId(rawUrl: string): string | null {
    const trimmed = this.normalizeInput(rawUrl);
    if (!trimmed) {
      return null;
    }

    const parsedUrl = this.tryParseUrl(trimmed);
    if (parsedUrl) {
      const propertyIdFromPath = this.extractPropertyIdFromPath(parsedUrl.pathname);
      if (propertyIdFromPath) {
        return propertyIdFromPath;
      }
    }

    return this.extractPropertyIdFromLooseText(trimmed);
  }

  static normalize(rawUrl: string, baseUrl?: string): string | null {
    const trimmed = this.normalizeInput(rawUrl);
    if (!trimmed) {
      return null;
    }

    const parsedUrl = this.tryParseUrl(trimmed, baseUrl);
    if (!parsedUrl) {
      return null;
    }

    const propertyId = this.extractPropertyIdFromPath(parsedUrl.pathname);
    if (!propertyId) {
      return null;
    }

    return `${parsedUrl.origin}/inmueble/${propertyId}/`;
  }

  private static normalizeInput(rawUrl: string): string {
    if (typeof rawUrl !== 'string') {
      return '';
    }
    return rawUrl.trim();
  }

  private static tryParseUrl(rawUrl: string, baseUrl?: string): URL | null {
    try {
      return baseUrl ? new URL(rawUrl, baseUrl) : new URL(rawUrl);
    } catch {
      return null;
    }
  }

  private static extractPropertyIdFromPath(pathname: string): string | null {
    const match = pathname.match(this.INMUEBLE_PATH_REGEX);
    return match?.[1] ?? null;
  }

  private static extractPropertyIdFromLooseText(rawValue: string): string | null {
    const match = rawValue.match(this.INMUEBLE_ANYWHERE_REGEX);
    return match?.[1] ?? null;
  }
}
