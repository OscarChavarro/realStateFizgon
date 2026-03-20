import { describe, expect, it, jest } from '@jest/globals';
import { CookieApprovalDialogScraperService } from 'src/application/services/scraper/property/cookie-approval-dialog-scraper.service';
import { CdpClient } from 'src/application/services/scraper/property/cdp-client.type';
import { GeoCoordinateHintService } from 'src/application/services/scraper/property/geo-coordinate-hint.service';
import { PropertyDetailDomExtractorService } from 'src/application/services/scraper/property/property-detail-dom-extractor.service';
import { PropertyDetailInteractionService } from 'src/application/services/scraper/property/property-detail-interaction.service';
import { PropertyDetailStorageService } from 'src/application/services/scraper/property/property-detail-storage.service';
import { HandleDeactivatedPropertyDetailUseCase } from 'src/application/usecases/scraper/handle-deactivated-property-detail.use-case';
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

class HandleDeactivatedPropertyDetailUseCaseMockForProcessLoadedPropertyDetailUseCase {
  readonly execute = jest.fn<(runtime: unknown, url: string) => Promise<boolean>>();
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
  const handleDeactivated = new HandleDeactivatedPropertyDetailUseCaseMockForProcessLoadedPropertyDetailUseCase();
  const extractor = new PropertyDetailDomExtractorServiceMockForProcessLoadedPropertyDetailUseCase();
  const geoCoordinateHint = new GeoCoordinateHintServiceMockForProcessLoadedPropertyDetailUseCase();
  const storage = new PropertyDetailStorageServiceMockForProcessLoadedPropertyDetailUseCase();

  const useCase = new ProcessLoadedPropertyDetailUseCase(
    cookie as unknown as CookieApprovalDialogScraperService,
    interaction as unknown as PropertyDetailInteractionService,
    handleDeactivated as unknown as HandleDeactivatedPropertyDetailUseCase,
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
    handleDeactivated,
    extractor,
    geoCoordinateHint,
    storage,
    captchaDetectorService
  };
}

describe('ProcessLoadedPropertyDetailUseCase', () => {
  it('whenDetailIsHandledAsDeactivatedBeforeMedia_execute_shouldReturnEarly', async () => {
    // Arrange
    const {
      useCase,
      interaction,
      cookie,
      handleDeactivated,
      extractor,
      captchaDetectorService
    } = createUseCase();
    const client = createClient();
    interaction.throwIfOriginErrorPage.mockResolvedValue(undefined);
    cookie.acceptCookiesIfVisible.mockResolvedValue(undefined);
    handleDeactivated.execute.mockResolvedValue(true);

    // Action
    await useCase.execute(client, 'https://www.idealista.com/inmueble/2/', 'ALWAYS');

    // Assert
    expect(captchaDetectorService.panicIfCaptchaDetected).toHaveBeenCalledTimes(1);
    expect(handleDeactivated.execute).toHaveBeenCalledTimes(1);
    expect(handleDeactivated.execute).toHaveBeenCalledWith(client.Runtime, 'https://www.idealista.com/inmueble/2/');
    expect(interaction.revealDetailMedia).not.toHaveBeenCalled();
    expect(extractor.extractProperty).not.toHaveBeenCalled();
  });

  it('whenDetailIsActiveAndExtracted_execute_shouldFilterEnrichAndPersistProperty', async () => {
    // Arrange
    const {
      useCase,
      interaction,
      cookie,
      handleDeactivated,
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
    handleDeactivated.execute.mockResolvedValue(false);
    extractor.extractProperty.mockResolvedValue(rawProperty);
    extractor.filterPropertyImagesByBlurPattern.mockReturnValue(filteredProperty);
    geoCoordinateHint.enrichProperty.mockResolvedValue(geoEnrichedProperty);
    storage.savePropertyWithImages.mockResolvedValue(undefined);

    // Action
    await useCase.execute(client, 'https://www.idealista.com/inmueble/3/', 'ALWAYS');

    // Assert
    expect(handleDeactivated.execute).toHaveBeenCalledTimes(1);
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
      handleDeactivated,
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
    handleDeactivated.execute.mockResolvedValue(false);
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
      handleDeactivated,
      extractor
    } = createUseCase();
    const client = createClient();
    interaction.throwIfOriginErrorPage.mockResolvedValue(undefined);
    interaction.revealDetailMedia.mockResolvedValue(undefined);
    cookie.acceptCookiesIfVisible.mockResolvedValue(undefined);
    handleDeactivated.execute.mockResolvedValue(false);
    extractor.extractProperty.mockResolvedValue(null);

    // Action
    const action = useCase.execute(client, 'https://www.idealista.com/inmueble/4/', 'ONLY_WHEN_MISSING_IN_DB');

    // Assert
    await expect(action).rejects.toThrow(
      'Property detail container was not found after loading URL: https://www.idealista.com/inmueble/4/'
    );
    expect(handleDeactivated.execute).toHaveBeenCalledTimes(2);
  });

  it('whenExtractionFailsAndThenIsHandledAsDeactivated_execute_shouldReturnWithoutThrowing', async () => {
    // Arrange
    const {
      useCase,
      interaction,
      cookie,
      handleDeactivated,
      extractor,
      storage
    } = createUseCase();
    const client = createClient();
    interaction.throwIfOriginErrorPage.mockResolvedValue(undefined);
    interaction.revealDetailMedia.mockResolvedValue(undefined);
    cookie.acceptCookiesIfVisible.mockResolvedValue(undefined);
    handleDeactivated.execute
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    extractor.extractProperty.mockResolvedValue(null);

    // Action
    await useCase.execute(client, 'https://www.idealista.com/inmueble/5/', 'ONLY_WHEN_MISSING_IN_DB');

    // Assert
    expect(handleDeactivated.execute).toHaveBeenCalledTimes(2);
    expect(storage.savePropertyWithImages).not.toHaveBeenCalled();
  });
});
