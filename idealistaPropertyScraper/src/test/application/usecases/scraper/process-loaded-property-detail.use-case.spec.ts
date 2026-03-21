import { describe, expect, it, jest } from '@jest/globals';
import { CookieApprovalDialogScraperService } from 'application/services/scraper/property/cookie-approval-dialog-scraper.service';
import { PropertyDetailInteractionService } from 'application/services/scraper/property/property-detail-interaction.service';
import { ExtractAndEnrichPropertyDetailUseCase } from 'application/usecases/scraper/extract-and-enrich-property-detail.use-case';
import { HandleDeactivatedPropertyDetailUseCase } from 'application/usecases/scraper/handle-deactivated-property-detail.use-case';
import { PersistPropertyDetailAndAssetsUseCase } from 'application/usecases/scraper/persist-property-detail-and-assets.use-case';
import { ProcessLoadedPropertyDetailUseCase } from 'application/usecases/scraper/process-loaded-property-detail.use-case';
import { PropertyFeatureGroup } from 'domain/property/property-feature-group';
import { PropertyImage } from 'domain/property/property-image';
import { PropertyMainFeatures } from 'domain/property/property-main-features';
import { Property } from 'domain/property/property';

import type { CaptchaDetectorPort } from 'ports/outbound/captcha/captcha-detector.port';
import type { PropertyCdpClient } from 'ports/outbound/browser/property-cdp-client.port';
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

class PersistPropertyDetailAndAssetsUseCaseMockForProcessLoadedPropertyDetailUseCase {
  readonly execute = jest.fn<(property: Property) => Promise<void>>();
}

class CaptchaDetectorPortMockForProcessLoadedPropertyDetailUseCase implements CaptchaDetectorPort {
  readonly panicIfCaptchaDetected = jest.fn(async () => undefined);
}

function createClient(): PropertyCdpClient {
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
  return Property.create({
    propertyId: null,
    url,
    title: 'Title',
    location: 'Madrid',
    price: 1000,
    mainFeatures: new PropertyMainFeatures('80 m2', '2', 'Exterior', []),
    advertiserComment: 'Comment',
    featureGroups: [new PropertyFeatureGroup('General', ['Ascensor'])],
    publicationAge: 'hace 1 día',
    images: [new PropertyImage('https://img/1.jpg', null)]
  });
}

function createUseCase() {
  const cookie = new CookieApprovalDialogScraperServiceMockForProcessLoadedPropertyDetailUseCase();
  const interaction = new PropertyDetailInteractionServiceMockForProcessLoadedPropertyDetailUseCase();
  const handleDeactivated = new HandleDeactivatedPropertyDetailUseCaseMockForProcessLoadedPropertyDetailUseCase();
  const extractAndEnrich = new ExtractAndEnrichPropertyDetailUseCaseMockForProcessLoadedPropertyDetailUseCase();
  const persistPropertyDetailAndAssetsUseCase =
    new PersistPropertyDetailAndAssetsUseCaseMockForProcessLoadedPropertyDetailUseCase();
  const captchaDetectorPort = new CaptchaDetectorPortMockForProcessLoadedPropertyDetailUseCase();
  captchaDetectorPort.panicIfCaptchaDetected.mockResolvedValue(undefined);

  const useCase = new ProcessLoadedPropertyDetailUseCase(
    cookie as unknown as CookieApprovalDialogScraperService,
    interaction as unknown as PropertyDetailInteractionService,
    handleDeactivated as unknown as HandleDeactivatedPropertyDetailUseCase,
    extractAndEnrich as unknown as ExtractAndEnrichPropertyDetailUseCase,
    persistPropertyDetailAndAssetsUseCase as unknown as PersistPropertyDetailAndAssetsUseCase,
    captchaDetectorPort
  );

  return {
    useCase,
    cookie,
    interaction,
    handleDeactivated,
    extractAndEnrich,
    persistPropertyDetailAndAssetsUseCase,
    captchaDetectorPort
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
      captchaDetectorPort
    } = createUseCase();
    const client = createClient();
    interaction.throwIfOriginErrorPage.mockResolvedValue(undefined);
    cookie.acceptCookiesIfVisible.mockResolvedValue(undefined);
    handleDeactivated.execute.mockResolvedValue(true);

    // Action
    await useCase.execute(client, 'https://www.idealista.com/inmueble/2/', 'ALWAYS');

    // Assert
    expect(captchaDetectorPort.panicIfCaptchaDetected).toHaveBeenCalledTimes(1);
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
      persistPropertyDetailAndAssetsUseCase
    } = createUseCase();
    const client = createClient();
    const enrichedProperty = createProperty('https://www.idealista.com/inmueble/3/');
    interaction.throwIfOriginErrorPage.mockResolvedValue(undefined);
    interaction.revealDetailMedia.mockResolvedValue(undefined);
    cookie.acceptCookiesIfVisible.mockResolvedValue(undefined);
    handleDeactivated.execute.mockResolvedValue(false);
    extractAndEnrich.execute.mockResolvedValue(enrichedProperty);
    persistPropertyDetailAndAssetsUseCase.execute.mockResolvedValue(undefined);

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
    expect(persistPropertyDetailAndAssetsUseCase.execute).toHaveBeenCalledWith(enrichedProperty);
  });

  it('whenDetailIsActiveAndExtractedFromDatabase_execute_shouldUseConditionalGeoHintMode', async () => {
    // Arrange
    const {
      useCase,
      interaction,
      cookie,
      handleDeactivated,
      extractAndEnrich,
      persistPropertyDetailAndAssetsUseCase
    } = createUseCase();
    const client = createClient();
    const enrichedProperty = createProperty('https://www.idealista.com/inmueble/3b/');
    interaction.throwIfOriginErrorPage.mockResolvedValue(undefined);
    interaction.revealDetailMedia.mockResolvedValue(undefined);
    cookie.acceptCookiesIfVisible.mockResolvedValue(undefined);
    handleDeactivated.execute.mockResolvedValue(false);
    extractAndEnrich.execute.mockResolvedValue(enrichedProperty);
    persistPropertyDetailAndAssetsUseCase.execute.mockResolvedValue(undefined);

    // Action
    await useCase.execute(client, 'https://www.idealista.com/inmueble/3b/', 'ONLY_WHEN_MISSING_IN_DB');

    // Assert
    expect(extractAndEnrich.execute).toHaveBeenCalledWith(
      client.Runtime,
      'https://www.idealista.com/inmueble/3b/',
      'ONLY_WHEN_MISSING_IN_DB'
    );
    expect(persistPropertyDetailAndAssetsUseCase.execute).toHaveBeenCalledWith(enrichedProperty);
  });

  it('whenExtractionPathReturnsNull_execute_shouldReturnWithoutPersisting', async () => {
    // Arrange
    const {
      useCase,
      interaction,
      cookie,
      handleDeactivated,
      extractAndEnrich,
      persistPropertyDetailAndAssetsUseCase
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
    expect(persistPropertyDetailAndAssetsUseCase.execute).not.toHaveBeenCalled();
  });
});
