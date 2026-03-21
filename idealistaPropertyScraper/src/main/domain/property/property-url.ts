import { PropertyId } from 'domain/property/property-id';

export class PropertyUrl {
  static readonly INMUEBLE_PATH_REGEX_SOURCE = '^\\/inmueble\\/(\\d+)(?:\\/|$)';

  private static readonly INMUEBLE_PATH_REGEX = new RegExp(PropertyUrl.INMUEBLE_PATH_REGEX_SOURCE, 'i');
  private static readonly INMUEBLE_ANYWHERE_REGEX = /\/inmueble\/(\d+)(?:\/|$)/i;

  private constructor(
    public readonly value: string,
    public readonly propertyId: PropertyId | null
  ) {}

  static create(rawUrl: string, baseUrl?: string): PropertyUrl {
    const trimmed = this.normalizeInput(rawUrl);
    if (!trimmed) {
      throw new Error('PropertyUrl cannot be empty.');
    }

    const parsedUrl = this.tryParseUrl(trimmed, baseUrl);
    if (!parsedUrl) {
      throw new Error(`PropertyUrl must be a valid URL: "${rawUrl}".`);
    }

    if (!this.isHttpProtocol(parsedUrl.protocol)) {
      throw new Error(`PropertyUrl must use http or https: "${rawUrl}".`);
    }

    const propertyId = this.extractPropertyIdFromPath(parsedUrl.pathname);
    if (propertyId) {
      const value = `${parsedUrl.origin}/inmueble/${propertyId}/`;
      return new PropertyUrl(value, PropertyId.create(propertyId));
    }

    return new PropertyUrl(parsedUrl.toString(), null);
  }

  static tryCreate(rawUrl: string, baseUrl?: string): PropertyUrl | null {
    try {
      return this.create(rawUrl, baseUrl);
    } catch {
      return null;
    }
  }

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
    const propertyUrl = this.tryCreate(rawUrl, baseUrl);
    if (!propertyUrl || !propertyUrl.propertyId) {
      return null;
    }

    return propertyUrl.value;
  }

  equals(other: PropertyUrl): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
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

  private static isHttpProtocol(protocol: string): boolean {
    return protocol === 'http:' || protocol === 'https:';
  }
}
