import { describe, expect, it, jest } from '@jest/globals';
import { CookieApprovalDialogScraperService } from 'src/application/services/scraper/property/cookie-approval-dialog-scraper.service';
import { CdpClient } from 'src/application/services/scraper/property/cdp-client.type';
import { DeactivatedDetailStatusService } from 'src/application/services/scraper/property/deactivated-detail-status.service';
import { GeoCoordinateHintService } from 'src/application/services/scraper/property/geo-coordinate-hint.service';
import { PropertyDetailDomExtractorService } from 'src/application/services/scraper/property/property-detail-dom-extractor.service';
import { PropertyDetailInteractionService } from 'src/application/services/scraper/property/property-detail-interaction.service';
import { PropertyDetailStorageService } from 'src/application/services/scraper/property/property-detail-storage.service';
import { ProcessLoadedPropertyDetailUseCase } from 'src/application/usecases/scraper/process-loaded-property-detail.use-case';
import { PropertyFeatureGroup } from 'src/domain/property/property-feature-group.model';
import { PropertyImage } from 'src/domain/property/property-image.model';
import { PropertyMainFeatures } from 'src/domain/property/property-main-features.model';
import { Property } from 'src/domain/property/property.model';

class CookieApprovalDialogScraperServiceMockForProcessLoadedPropertyDetailUseCase {
  readonly acceptCookiesIfVisible = jest.fn<(runtime: unknown) => Promise<void>>();
}

class PropertyDetailInteractionServiceMockForProcessLoadedPropertyDetailUseCase {
  readonly throwIfOriginErrorPage = jest.fn<(runtime: unknown) => Promise<void>>();
  readonly revealDetailMedia = jest.fn<(runtime: unknown) => Promise<void>>();
}

class DeactivatedDetailStatusServiceMockForProcessLoadedPropertyDetailUseCase {
  readonly detect = jest.fn<(runtime: unknown) => Promise<{ isDeactivated: boolean; closedBy: Date | null }>>();
}

class PropertyDetailDomExtractorServiceMockForProcessLoadedPropertyDetailUseCase {
  readonly extractProperty = jest.fn<(runtime: unknown, url: string) => Promise<Property | null>>();
  readonly filterPropertyImagesByBlurPattern = jest.fn<(property: Property) => Property>();
}

class GeoCoordinateHintServiceMockForProcessLoadedPropertyDetailUseCase {
  readonly enrichProperty = jest.fn<
    (runtime: unknown, property: Property, mode: 'ALWAYS' | 'ONLY_WHEN_MISSING_IN_DB') => Promise<Property>
  >();
}

class PropertyDetailStorageServiceMockForProcessLoadedPropertyDetailUseCase {
  readonly markPropertyClosed = jest.fn<(url: string, closedBy?: Date) => Promise<void>>();
  readonly savePropertyWithImages = jest.fn<(property: Property) => Promise<void>>();
}

function createClient(): CdpClient {
  return {
    Page: {
      bringToFront: jest.fn(async () => undefined)
    },
    Runtime: {
      evaluate: jest.fn(async () => ({ result: { value: true } }))
    }
  };
}

function createProperty(url: string): Property {
  return new Property(
    '123',
    url,
    'Title',
    'Madrid',
    1000,
    new PropertyMainFeatures('80 m2', '2', 'Exterior', []),
    'Comment',
    [new PropertyFeatureGroup('General', ['Ascensor'])],
    'hace 1 día',
    [new PropertyImage('https://img/1.jpg', null)]
  );
}

function createUseCase() {
  const cookie = new CookieApprovalDialogScraperServiceMockForProcessLoadedPropertyDetailUseCase();
  const interaction = new PropertyDetailInteractionServiceMockForProcessLoadedPropertyDetailUseCase();
  const deactivated = new DeactivatedDetailStatusServiceMockForProcessLoadedPropertyDetailUseCase();
  const extractor = new PropertyDetailDomExtractorServiceMockForProcessLoadedPropertyDetailUseCase();
  const geoCoordinateHint = new GeoCoordinateHintServiceMockForProcessLoadedPropertyDetailUseCase();
  const storage = new PropertyDetailStorageServiceMockForProcessLoadedPropertyDetailUseCase();

  const useCase = new ProcessLoadedPropertyDetailUseCase(
    cookie as unknown as CookieApprovalDialogScraperService,
    interaction as unknown as PropertyDetailInteractionService,
    deactivated as unknown as DeactivatedDetailStatusService,
    extractor as unknown as PropertyDetailDomExtractorService,
    geoCoordinateHint as unknown as GeoCoordinateHintService,
    storage as unknown as PropertyDetailStorageService
  );

  const captchaDetectorService = {
    panicIfCaptchaDetected: jest.fn<(args: { runtime: unknown; logger: unknown; context: string }) => Promise<void>>()
  };
  captchaDetectorService.panicIfCaptchaDetected.mockResolvedValue(undefined);
  (useCase as unknown as { captchaDetectorService: typeof captchaDetectorService }).captchaDetectorService =
    captchaDetectorService;

  return {
    useCase,
    cookie,
    interaction,
    deactivated,
    extractor,
    geoCoordinateHint,
    storage,
    captchaDetectorService
  };
}

describe('ProcessLoadedPropertyDetailUseCase', () => {
  it('whenLoadedDetailIsDeactivated_execute_shouldMarkClosed', async () => {
    // Arrange
    const {
      useCase,
      interaction,
      cookie,
      deactivated,
      storage,
      extractor,
      captchaDetectorService
    } = createUseCase();
    const client = createClient();
    interaction.throwIfOriginErrorPage.mockResolvedValue(undefined);
    cookie.acceptCookiesIfVisible.mockResolvedValue(undefined);
    deactivated.detect.mockResolvedValue({ isDeactivated: true, closedBy: new Date('2026-02-01T00:00:00.000Z') });
    storage.markPropertyClosed.mockResolvedValue(undefined);

    // Action
    await useCase.execute(client, 'https://www.idealista.com/inmueble/2/', 'ALWAYS');

    // Assert
    expect(captchaDetectorService.panicIfCaptchaDetected).toHaveBeenCalledTimes(1);
    expect(storage.markPropertyClosed).toHaveBeenCalledWith('https://www.idealista.com/inmueble/2/', new Date('2026-02-01T00:00:00.000Z'));
    expect(extractor.extractProperty).not.toHaveBeenCalled();
  });

  it('whenLoadedDetailIsDeactivatedWithoutClosedDate_execute_shouldMarkClosedWithUndefinedDate', async () => {
    // Arrange
    const {
      useCase,
      interaction,
      cookie,
      deactivated,
      storage
    } = createUseCase();
    const client = createClient();
    interaction.throwIfOriginErrorPage.mockResolvedValue(undefined);
    cookie.acceptCookiesIfVisible.mockResolvedValue(undefined);
    deactivated.detect.mockResolvedValue({ isDeactivated: true, closedBy: null });
    storage.markPropertyClosed.mockResolvedValue(undefined);

    // Action
    await useCase.execute(client, 'https://www.idealista.com/inmueble/2b/', 'ALWAYS');

    // Assert
    expect(storage.markPropertyClosed).toHaveBeenCalledWith('https://www.idealista.com/inmueble/2b/', undefined);
  });

  it('whenDetailIsActiveAndExtracted_execute_shouldFilterEnrichAndPersistProperty', async () => {
    // Arrange
    const {
      useCase,
      interaction,
      cookie,
      deactivated,
      extractor,
      geoCoordinateHint,
      storage
    } = createUseCase();
    const client = createClient();
    const rawProperty = createProperty('https://www.idealista.com/inmueble/3/');
    const filteredProperty = createProperty('https://www.idealista.com/inmueble/3/');
    const geoEnrichedProperty = new Property(
      filteredProperty.propertyId,
      filteredProperty.url,
      filteredProperty.title,
      filteredProperty.location,
      filteredProperty.price,
      filteredProperty.mainFeatures,
      filteredProperty.advertiserComment,
      filteredProperty.featureGroups,
      filteredProperty.publicationAge,
      filteredProperty.images,
      { lat: 40.5, lon: -3.6 }
    );
    interaction.throwIfOriginErrorPage.mockResolvedValue(undefined);
    interaction.revealDetailMedia.mockResolvedValue(undefined);
    cookie.acceptCookiesIfVisible.mockResolvedValue(undefined);
    deactivated.detect.mockResolvedValue({ isDeactivated: false, closedBy: null });
    extractor.extractProperty.mockResolvedValue(rawProperty);
    extractor.filterPropertyImagesByBlurPattern.mockReturnValue(filteredProperty);
    geoCoordinateHint.enrichProperty.mockResolvedValue(geoEnrichedProperty);
    storage.savePropertyWithImages.mockResolvedValue(undefined);

    // Action
    await useCase.execute(client, 'https://www.idealista.com/inmueble/3/', 'ALWAYS');

    // Assert
    expect(interaction.revealDetailMedia).toHaveBeenCalledWith(client.Runtime);
    expect(extractor.filterPropertyImagesByBlurPattern).toHaveBeenCalledWith(rawProperty);
    expect(geoCoordinateHint.enrichProperty).toHaveBeenCalledWith(client.Runtime, filteredProperty, 'ALWAYS');
    expect(storage.savePropertyWithImages).toHaveBeenCalledWith(geoEnrichedProperty);
  });

  it('whenDetailIsActiveAndExtractedFromDatabase_execute_shouldEnrichOnlyWhenMissingGeoLocationHint', async () => {
    // Arrange
    const {
      useCase,
      interaction,
      cookie,
      deactivated,
      extractor,
      geoCoordinateHint,
      storage
    } = createUseCase();
    const client = createClient();
    const rawProperty = createProperty('https://www.idealista.com/inmueble/3b/');
    const filteredProperty = createProperty('https://www.idealista.com/inmueble/3b/');
    interaction.throwIfOriginErrorPage.mockResolvedValue(undefined);
    interaction.revealDetailMedia.mockResolvedValue(undefined);
    cookie.acceptCookiesIfVisible.mockResolvedValue(undefined);
    deactivated.detect.mockResolvedValue({ isDeactivated: false, closedBy: null });
    extractor.extractProperty.mockResolvedValue(rawProperty);
    extractor.filterPropertyImagesByBlurPattern.mockReturnValue(filteredProperty);
    geoCoordinateHint.enrichProperty.mockResolvedValue(filteredProperty);
    storage.savePropertyWithImages.mockResolvedValue(undefined);

    // Action
    await useCase.execute(client, 'https://www.idealista.com/inmueble/3b/', 'ONLY_WHEN_MISSING_IN_DB');

    // Assert
    expect(geoCoordinateHint.enrichProperty).toHaveBeenCalledWith(
      client.Runtime,
      filteredProperty,
      'ONLY_WHEN_MISSING_IN_DB'
    );
    expect(storage.savePropertyWithImages).toHaveBeenCalledWith(filteredProperty);
  });

  it('whenExtractionFailsAndStillActive_execute_shouldThrowContainerNotFoundError', async () => {
    // Arrange
    const {
      useCase,
      interaction,
      cookie,
      deactivated,
      extractor
    } = createUseCase();
    const client = createClient();
    interaction.throwIfOriginErrorPage.mockResolvedValue(undefined);
    interaction.revealDetailMedia.mockResolvedValue(undefined);
    cookie.acceptCookiesIfVisible.mockResolvedValue(undefined);
    deactivated.detect
      .mockResolvedValueOnce({ isDeactivated: false, closedBy: null })
      .mockResolvedValueOnce({ isDeactivated: false, closedBy: null });
    extractor.extractProperty.mockResolvedValue(null);

    // Action
    const action = useCase.execute(client, 'https://www.idealista.com/inmueble/4/', 'ONLY_WHEN_MISSING_IN_DB');

    // Assert
    await expect(action).rejects.toThrow(
      'Property detail container was not found after loading URL: https://www.idealista.com/inmueble/4/'
    );
  });

  it('whenExtractionFailsAndThenDeactivated_execute_shouldMarkClosed', async () => {
    // Arrange
    const {
      useCase,
      interaction,
      cookie,
      deactivated,
      extractor,
      storage
    } = createUseCase();
    const client = createClient();
    const closedBy = new Date('2026-02-02T00:00:00.000Z');
    interaction.throwIfOriginErrorPage.mockResolvedValue(undefined);
    interaction.revealDetailMedia.mockResolvedValue(undefined);
    cookie.acceptCookiesIfVisible.mockResolvedValue(undefined);
    deactivated
      .detect
      .mockResolvedValueOnce({ isDeactivated: false, closedBy: null })
      .mockResolvedValueOnce({ isDeactivated: true, closedBy });
    extractor.extractProperty.mockResolvedValue(null);
    storage.markPropertyClosed.mockResolvedValue(undefined);

    // Action
    await useCase.execute(client, 'https://www.idealista.com/inmueble/5/', 'ONLY_WHEN_MISSING_IN_DB');

    // Assert
    expect(storage.markPropertyClosed).toHaveBeenCalledWith('https://www.idealista.com/inmueble/5/', closedBy);
  });

  it('whenExtractionFailsAndThenDeactivatedWithoutClosedDate_execute_shouldMarkClosedWithUndefinedDate', async () => {
    // Arrange
    const {
      useCase,
      interaction,
      cookie,
      deactivated,
      extractor,
      storage
    } = createUseCase();
    const client = createClient();
    interaction.throwIfOriginErrorPage.mockResolvedValue(undefined);
    interaction.revealDetailMedia.mockResolvedValue(undefined);
    cookie.acceptCookiesIfVisible.mockResolvedValue(undefined);
    deactivated
      .detect
      .mockResolvedValueOnce({ isDeactivated: false, closedBy: null })
      .mockResolvedValueOnce({ isDeactivated: true, closedBy: null });
    extractor.extractProperty.mockResolvedValue(null);
    storage.markPropertyClosed.mockResolvedValue(undefined);

    // Action
    await useCase.execute(client, 'https://www.idealista.com/inmueble/5b/', 'ONLY_WHEN_MISSING_IN_DB');

    // Assert
    expect(storage.markPropertyClosed).toHaveBeenCalledWith('https://www.idealista.com/inmueble/5b/', undefined);
  });
});
