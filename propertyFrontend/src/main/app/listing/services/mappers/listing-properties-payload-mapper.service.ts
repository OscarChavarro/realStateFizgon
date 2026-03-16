import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { GeoLocationHint, ListingPropertyRow } from 'src/app/listing/model/listing.types';
import { PropertiesResponse } from 'src/app/listing/model/listing-data.payload.types';

@Injectable({
  providedIn: 'root'
})
export class ListingPropertiesPayloadMapperService {
  extractMaxAllowedPageSize(error: unknown): number | null {
    if (!(error instanceof HttpErrorResponse)) {
      return null;
    }

    const candidates: string[] = [];
    if (typeof error.error === 'string') {
      candidates.push(error.error);
    } else if (typeof error.error === 'object' && error.error !== null) {
      const nestedMessage = (error.error as { error?: unknown; message?: unknown }).error
        ?? (error.error as { error?: unknown; message?: unknown }).message;
      if (typeof nestedMessage === 'string') {
        candidates.push(nestedMessage);
      }
    }
    if (typeof error.message === 'string') {
      candidates.push(error.message);
    }

    for (const message of candidates) {
      const match = message.match(/pageSize\s+cannot\s+be\s+greater\s+than\s+total\s+properties\s+\((\d+)\)/i);
      if (!match) {
        continue;
      }

      const parsed = Number.parseInt(match[1], 10);
      if (Number.isFinite(parsed) && parsed >= 1) {
        return parsed;
      }
      return 1;
    }

    return null;
  }

  mapPropertiesForListing(rawRows: PropertiesResponse['data']): ListingPropertyRow[] {
    return rawRows.map((row) => {
      const closedByValue = row.closedBy ?? row.closedby ?? row.closed_by;
      const closedByExistsFromPayload = (
        Object.prototype.hasOwnProperty.call(row, 'closedBy')
        || Object.prototype.hasOwnProperty.call(row, 'closedby')
        || Object.prototype.hasOwnProperty.call(row, 'closed_by')
        || Object.prototype.hasOwnProperty.call(row, 'closedByExists')
      );

      const publicationDate = this.toDateTimeString(row.publicationDate);
      const publicationDateShort = this.toDateOnlyString(row.publicationDate);
      const propertyId = row.propertyId === undefined || row.propertyId === null
        ? ''
        : String(row.propertyId);

      const title = typeof row.title === 'string' && row.title.trim().length > 0
        ? row.title.trim()
        : '-';
      const url = typeof row.url === 'string' ? row.url.trim() : '';
      const location = typeof row.location === 'string' && row.location.trim().length > 0
        ? row.location.trim()
        : '';
      const advertiserComment = typeof row.advertiserComment === 'string' && row.advertiserComment.trim().length > 0
        ? row.advertiserComment.trim()
        : (typeof row.description === 'string' ? row.description.trim() : '');
      const price = row.price === null || row.price === undefined
        ? '-'
        : String(row.price);
      const area = this.normalizeMainFeatureValue(row.mainFeatures?.area);
      const bedrooms = this.normalizeMainFeatureValue(row.mainFeatures?.bedrooms);
      const geoLocationHint = this.parseGeoLocationHint(row.geoLocationHint);

      return {
        propertyId,
        publicationDate,
        publicationDateShort,
        title,
        url,
        price,
        ...(area.length > 0 ? { area } : {}),
        ...(bedrooms.length > 0 ? { bedrooms } : {}),
        location,
        advertiserComment,
        localImageUrls: this.extractLocalImageUrls(row.images),
        unavailable: this.isUnavailable(
          closedByValue,
          row.isClosed,
          row.closedByExists ?? closedByExistsFromPayload
        ),
        geoLocationHint
      };
    });
  }

  toDateOnlyString(value: unknown): string {
    if (typeof value === 'string') {
      const raw = value.trim();
      if (!raw) {
        return '';
      }

      const isoDatePrefix = raw.match(/^(\d{4}-\d{2}-\d{2})/);
      if (isoDatePrefix) {
        return isoDatePrefix[1];
      }

      const parsedFromString = new Date(raw);
      if (!Number.isNaN(parsedFromString.getTime())) {
        return this.formatLocalDate(parsedFromString);
      }

      return '';
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return this.formatLocalDate(value);
    }

    return '';
  }

  normalizeMainFeatureValue(value: unknown): string {
    if (typeof value === 'string') {
      return value.trim();
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }

    return '';
  }

  toDateTimeString(value: unknown): string {
    if (typeof value === 'string') {
      const raw = value.trim();
      if (!raw) {
        return '';
      }

      const parsedFromString = new Date(raw);
      if (!Number.isNaN(parsedFromString.getTime())) {
        return parsedFromString.toISOString();
      }

      return raw;
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString();
    }

    return '';
  }

  extractLocalImageUrls(images: PropertiesResponse['data'][number]['images']): string[] {
    if (!Array.isArray(images)) {
      return [];
    }

    const localUrls: string[] = [];
    for (const imageItem of images) {
      if (typeof imageItem !== 'object' || imageItem === null) {
        continue;
      }

      const localUrl = typeof imageItem.localUrl === 'string' ? imageItem.localUrl.trim() : '';
      if (localUrl.length > 0) {
        localUrls.push(localUrl);
      }
    }

    return localUrls;
  }

  parseGeoLocationHint(value: PropertiesResponse['data'][number]['geoLocationHint']): GeoLocationHint | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const lat = this.toFiniteNumber(value.lat ?? value.latitude);
    const lon = this.toFiniteNumber(value.lon ?? value.longitude);
    if (lat === null || lon === null) {
      return null;
    }

    return { lat, lon };
  }

  toFiniteNumber(value: unknown): number | null {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }

      const parsed = Number.parseFloat(trimmed);
      return Number.isFinite(parsed) ? parsed : null;
    }

    if (value && typeof value === 'object') {
      const numberDecimalCandidate = (value as { $numberDecimal?: unknown }).$numberDecimal;
      if (typeof numberDecimalCandidate === 'string') {
        const parsed = Number.parseFloat(numberDecimalCandidate.trim());
        return Number.isFinite(parsed) ? parsed : null;
      }

      if (typeof (value as { valueOf?: unknown }).valueOf === 'function') {
        const primitive = (value as { valueOf: () => unknown }).valueOf();
        if (typeof primitive === 'number' && Number.isFinite(primitive)) {
          return primitive;
        }
        if (typeof primitive === 'string') {
          const parsed = Number.parseFloat(primitive.trim());
          return Number.isFinite(parsed) ? parsed : null;
        }
      }
    }

    return null;
  }

  hasClosedByValue(value: unknown): boolean {
    if (value === null || value === undefined) {
      return false;
    }

    if (typeof value === 'string') {
      return value.trim().length > 0;
    }

    if (value instanceof Date) {
      return !Number.isNaN(value.getTime());
    }

    return true;
  }

  isUnavailable(closedBy: unknown, isClosed: unknown, closedByExists: unknown): boolean {
    if (typeof closedByExists === 'boolean') {
      if (closedByExists) {
        return true;
      }
    } else if (typeof closedByExists === 'string') {
      const normalized = closedByExists.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
        return true;
      }
    } else if (typeof closedByExists === 'number' && closedByExists !== 0) {
      return true;
    }

    if (typeof isClosed === 'boolean') {
      return isClosed;
    }

    if (typeof isClosed === 'string') {
      const normalized = isClosed.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
        return true;
      }
      if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === '') {
        return false;
      }
    }

    if (typeof isClosed === 'number') {
      return isClosed !== 0;
    }

    return this.hasClosedByValue(closedBy);
  }

  private formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
