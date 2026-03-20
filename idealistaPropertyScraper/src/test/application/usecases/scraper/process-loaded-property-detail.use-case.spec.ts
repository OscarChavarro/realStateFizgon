import { describe, expect, it, jest } from '@jest/globals';
import { CookieApprovalDialogScraperService } from 'src/application/services/scraper/property/cookie-approval-dialog-scraper.service';
import { CdpClient } from 'src/application/services/scraper/property/cdp-client.type';
import { PropertyDetailInteractionService } from 'src/application/services/scraper/property/property-detail-interaction.service';
import { PropertyDetailStorageService } from 'src/application/services/scraper/property/property-detail-storage.service';
import { ExtractAndEnrichPropertyDetailUseCase } from 'src/application/usecases/scraper/extract-and-enrich-property-detail.use-case';
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

class ExtractAndEnrichPropertyDetailUseCaseMockForProcessLoadedPropertyDetailUseCase {
  readonly execute = jest.fn<
    (runtime: unknown, url: string, mode: 'ALWAYS' | 'ONLY_WHEN_MISSING_IN_DB') => Promise<Property | null>
  >();
}

class PropertyDetailStorageServiceMockForProcessLoadedPropertyDetailUseCase {
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
  const extractAndEnrich = new ExtractAndEnrichPropertyDetailUseCaseMockForProcessLoadedPropertyDetailUseCase();
  const storage = new PropertyDetailStorageServiceMockForProcessLoadedPropertyDetailUseCase();

  const useCase = new ProcessLoadedPropertyDetailUseCase(
    cookie as unknown as CookieApprovalDialogScraperService,
    interaction as unknown as PropertyDetailInteractionService,
    handleDeactivated as unknown as HandleDeactivatedPropertyDetailUseCase,
    extractAndEnrich as unknown as ExtractAndEnrichPropertyDetailUseCase,
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
    extractAndEnrich,
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
      extractAndEnrich,
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
    expect(extractAndEnrich.execute).not.toHaveBeenCalled();
  });

  it('whenDetailIsActiveAndExtracted_execute_shouldExtractEnrichAndPersistProperty', async () => {
    // Arrange
    const {
      useCase,
      interaction,
      cookie,
      handleDeactivated,
      extractAndEnrich,
      storage
    } = createUseCase();
    const client = createClient();
    const enrichedProperty = createProperty('https://www.idealista.com/inmueble/3/');
    interaction.throwIfOriginErrorPage.mockResolvedValue(undefined);
    interaction.revealDetailMedia.mockResolvedValue(undefined);
    cookie.acceptCookiesIfVisible.mockResolvedValue(undefined);
    handleDeactivated.execute.mockResolvedValue(false);
    extractAndEnrich.execute.mockResolvedValue(enrichedProperty);
    storage.savePropertyWithImages.mockResolvedValue(undefined);

    // Action
    await useCase.execute(client, 'https://www.idealista.com/inmueble/3/', 'ALWAYS');

    // Assert
    expect(handleDeactivated.execute).toHaveBeenCalledTimes(1);
    expect(interaction.revealDetailMedia).toHaveBeenCalledWith(client.Runtime);
    expect(extractAndEnrich.execute).toHaveBeenCalledWith(
      client.Runtime,
      'https://www.idealista.com/inmueble/3/',
      'ALWAYS'
    );
    expect(storage.savePropertyWithImages).toHaveBeenCalledWith(enrichedProperty);
  });

  it('whenDetailIsActiveAndExtractedFromDatabase_execute_shouldUseConditionalGeoHintMode', async () => {
    // Arrange
    const {
      useCase,
      interaction,
      cookie,
      handleDeactivated,
      extractAndEnrich,
      storage
    } = createUseCase();
    const client = createClient();
    const enrichedProperty = createProperty('https://www.idealista.com/inmueble/3b/');
    interaction.throwIfOriginErrorPage.mockResolvedValue(undefined);
    interaction.revealDetailMedia.mockResolvedValue(undefined);
    cookie.acceptCookiesIfVisible.mockResolvedValue(undefined);
    handleDeactivated.execute.mockResolvedValue(false);
    extractAndEnrich.execute.mockResolvedValue(enrichedProperty);
    storage.savePropertyWithImages.mockResolvedValue(undefined);

    // Action
    await useCase.execute(client, 'https://www.idealista.com/inmueble/3b/', 'ONLY_WHEN_MISSING_IN_DB');

    // Assert
    expect(extractAndEnrich.execute).toHaveBeenCalledWith(
      client.Runtime,
      'https://www.idealista.com/inmueble/3b/',
      'ONLY_WHEN_MISSING_IN_DB'
    );
    expect(storage.savePropertyWithImages).toHaveBeenCalledWith(enrichedProperty);
  });

  it('whenExtractionPathReturnsNull_execute_shouldReturnWithoutPersisting', async () => {
    // Arrange
    const {
      useCase,
      interaction,
      cookie,
      handleDeactivated,
      extractAndEnrich,
      storage
    } = createUseCase();
    const client = createClient();
    interaction.throwIfOriginErrorPage.mockResolvedValue(undefined);
    interaction.revealDetailMedia.mockResolvedValue(undefined);
    cookie.acceptCookiesIfVisible.mockResolvedValue(undefined);
    handleDeactivated.execute.mockResolvedValue(false);
    extractAndEnrich.execute.mockResolvedValue(null);

    // Action
    await useCase.execute(client, 'https://www.idealista.com/inmueble/5/', 'ONLY_WHEN_MISSING_IN_DB');

    // Assert
    expect(extractAndEnrich.execute).toHaveBeenCalledTimes(1);
    expect(storage.savePropertyWithImages).not.toHaveBeenCalled();
  });
});
