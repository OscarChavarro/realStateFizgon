import { describe, expect, it, jest } from '@jest/globals';
import { MongoPublicationDateMapperService } from 'src/adapters/outbound/persistence/mongodb/mongo-publication-date-mapper.service';

describe('MongoPublicationDateMapperService', () => {
  it.each([
    {
      publicationAge: 'Anuncio actualizado hace 10 días',
      expected: '2026-03-03T10:00:00.000Z'
    },
    {
      publicationAge: 'Anuncio actualizado hace 10 horas',
      expected: '2026-03-13T00:00:00.000Z'
    },
    {
      publicationAge: 'Anuncio actualizado hace 11 minutos',
      expected: '2026-03-13T09:49:00.000Z'
    },
    {
      publicationAge: 'Anuncio actualizado hace más de 3 meses',
      expected: '2025-12-13T10:00:00.000Z'
    },
    {
      publicationAge: 'Anuncio actualizado hace más de un mes',
      expected: '2026-02-13T10:00:00.000Z'
    },
    {
      publicationAge: 'Anuncio actualizado hace un día',
      expected: '2026-03-12T10:00:00.000Z'
    },
    {
      publicationAge: 'Anuncio actualizado hace un minuto',
      expected: '2026-03-13T09:59:00.000Z'
    }
  ])('whenPublicationAgeIsSupported_mapPublicationDate_shouldReturnExpectedDate', ({ publicationAge, expected }) => {
    // Arrange
    const service = new MongoPublicationDateMapperService();
    const now = new Date('2026-03-13T10:00:00.000Z');
    // Action
    const publicationDate = service.mapPublicationDate(publicationAge, now);
    // Assert
    expect(publicationDate?.toISOString()).toBe(expected);
  });

  it.each([
    null,
    '',
    '   ',
    'Texto sin prefijo',
    'Anuncio actualizado hace aproximadamente 2 días',
    'Anuncio actualizado hace 0 minutos'
  ])('whenPublicationAgeIsUnsupported_mapPublicationDate_shouldReturnNull', (publicationAge) => {
    // Arrange
    const service = new MongoPublicationDateMapperService();
    const now = new Date('2026-03-13T10:00:00.000Z');
    // Action
    const publicationDate = service.mapPublicationDate(publicationAge, now);
    // Assert
    expect(publicationDate).toBeNull();
  });

  it('whenNowIsOmitted_mapPublicationDate_shouldUseSystemTimeAsReference', () => {
    // Arrange
    const service = new MongoPublicationDateMapperService();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-13T10:00:00.000Z'));
    try {
      // Action
      const publicationDate = service.mapPublicationDate('Anuncio actualizado hace un minuto');
      // Assert
      expect(publicationDate?.toISOString()).toBe('2026-03-13T09:59:00.000Z');
    } finally {
      jest.useRealTimers();
    }
  });

  it('whenPublicationAgeIsInYears_mapPublicationDate_shouldSubtractYears', () => {
    // Arrange
    const service = new MongoPublicationDateMapperService();
    const now = new Date('2026-03-13T10:00:00.000Z');
    // Action
    const publicationDate = service.mapPublicationDate('Anuncio actualizado hace 2 anos', now);
    // Assert
    expect(publicationDate?.toISOString()).toBe('2024-03-13T10:00:00.000Z');
  });

  it('whenInternalMapUnitReturnsNull_mapPublicationDate_shouldReturnNull', () => {
    // Arrange
    const service = new MongoPublicationDateMapperService();
    const now = new Date('2026-03-13T10:00:00.000Z');
    const mapUnitSpy = jest.spyOn(service as any, 'mapUnit').mockReturnValue(null);
    // Action
    const publicationDate = service.mapPublicationDate('Anuncio actualizado hace 3 dias', now);
    // Assert
    expect(publicationDate).toBeNull();
    mapUnitSpy.mockRestore();
  });

  it('whenUnitTokenIsUnsupported_mapUnit_shouldReturnNull', () => {
    // Arrange
    const service = new MongoPublicationDateMapperService();
    // Action
    const unit = (service as any).mapUnit('siglos');
    // Assert
    expect(unit).toBeNull();
  });
});
