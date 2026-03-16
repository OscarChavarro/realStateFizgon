import { HttpErrorResponse } from '@angular/common/http';
import { ListingPropertiesPayloadMapperService } from 'src/app/listing/services/mappers/listing-properties-payload-mapper.service';

describe('ListingPropertiesPayloadMapperService', () => {
  it('extractMaxAllowedPageSize should parse size limit from known error payload formats', () => {
    // Arrange
    const mapper = new ListingPropertiesPayloadMapperService();
    const fromErrorField = new HttpErrorResponse({
      status: 400,
      error: { error: 'pageSize cannot be greater than total properties (9)' }
    });
    const fromMessageField = new HttpErrorResponse({
      status: 400,
      error: { message: 'pageSize cannot be greater than total properties (5)' }
    });

    // Action
    const parsedErrorField = mapper.extractMaxAllowedPageSize(fromErrorField);
    const parsedMessageField = mapper.extractMaxAllowedPageSize(fromMessageField);
    const parsedFallback = mapper.extractMaxAllowedPageSize(new Error('boom'));

    // Assert
    expect(parsedErrorField).toBe(9);
    expect(parsedMessageField).toBe(5);
    expect(parsedFallback).toBeNull();
  });

  it('mapPropertiesForListing should normalize and map payload rows into listing rows', () => {
    // Arrange
    const mapper = new ListingPropertiesPayloadMapperService();
    const payload = [
      {
        publicationDate: '2026-03-15T10:00:00.000Z',
        closedBy: 'done',
        propertyId: 10,
        title: '  Main title  ',
        location: '  Madrid  ',
        description: 'description',
        advertiserComment: '',
        url: ' https://example.com/p/10 ',
        price: 1800,
        mainFeatures: {
          area: ' 82 m² ',
          bedrooms: 2
        },
        images: [{ localUrl: ' /img/a.jpg ' }, 'invalid'],
        geoLocationHint: { lat: '40.5', lon: '-3.6' }
      }
    ];

    // Action
    const result = mapper.mapPropertiesForListing(payload);

    // Assert
    expect(result).toEqual([
      {
        propertyId: '10',
        publicationDate: '2026-03-15T10:00:00.000Z',
        publicationDateShort: '2026-03-15',
        title: 'Main title',
        url: 'https://example.com/p/10',
        price: '1800',
        area: '82 m²',
        bedrooms: '2',
        location: 'Madrid',
        advertiserComment: 'description',
        localImageUrls: ['/img/a.jpg'],
        unavailable: true,
        geoLocationHint: { lat: 40.5, lon: -3.6 }
      }
    ]);
  });

  it('helpers should normalize values for dates, numbers, geolocation and availability', () => {
    // Arrange
    const mapper = new ListingPropertiesPayloadMapperService();

    // Action
    const dateOnly = mapper.toDateOnlyString('March 1, 2026');
    const dateTime = mapper.toDateTimeString('2026-03-15T10:00:00.000Z');
    const finiteNumber = mapper.toFiniteNumber({ $numberDecimal: '4.2' });
    const geoHint = mapper.parseGeoLocationHint({ latitude: '40.1', longitude: '-3.7' });
    const unavailable = mapper.isUnavailable(null, '1', false);

    // Assert
    expect(dateOnly).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(dateTime).toBe('2026-03-15T10:00:00.000Z');
    expect(finiteNumber).toBe(4.2);
    expect(geoHint).toEqual({ lat: 40.1, lon: -3.7 });
    expect(unavailable).toBeTrue();
  });
});
