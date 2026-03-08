import { describe, expect, it, jest } from '@jest/globals';
import { CookieApprovalDialogScraperService } from 'src/application/services/scraper/property/cookie-approval-dialog-scraper.service';
import { CdpClient } from 'src/application/services/scraper/property/cdp-client.type';
import { DeactivatedDetailStatusService } from 'src/application/services/scraper/property/deactivated-detail-status.service';
import { PropertyDetailDomExtractorService } from 'src/application/services/scraper/property/property-detail-dom-extractor.service';
import { PropertyDetailInteractionService } from 'src/application/services/scraper/property/property-detail-interaction.service';
import { PropertyDetailNavigationService } from 'src/application/services/scraper/property/property-detail-navigation.service';
import { PropertyDetailPageService } from 'src/application/services/scraper/property/property-detail-page.service';
import { PropertyDetailStorageService } from 'src/application/services/scraper/property/property-detail-storage.service';
import { PropertyFeatureGroup } from 'src/domain/property/property-feature-group.model';
import { PropertyImage } from 'src/domain/property/property-image.model';
import { PropertyMainFeatures } from 'src/domain/property/property-main-features.model';
import { Property } from 'src/domain/property/property.model';

class CookieApprovalDialogScraperServiceMockForDetailPage {
  readonly acceptCookiesIfVisible = jest.fn<(runtime: unknown) => Promise<void>>();
}

class PropertyDetailNavigationServiceMockForDetailPage {
  readonly clickPropertyLinkFromResults = jest.fn<(runtime: unknown, targetUrl: string) => Promise<boolean>>();
  readonly waitForDetailUrlAndDomComplete = jest.fn<(runtime: unknown, targetUrl: string) => Promise<void>>();
  readonly navigateDirectlyToUrl = jest.fn<(runtime: unknown, targetUrl: string) => Promise<void>>();
  readonly goBackToSearchResults = jest.fn<(runtime: unknown) => Promise<void>>();
}

class PropertyDetailInteractionServiceMockForDetailPage {
  readonly throwIfOriginErrorPage = jest.fn<(runtime: unknown) => Promise<void>>();
  readonly revealDetailMedia = jest.fn<(runtime: unknown) => Promise<void>>();
}

class DeactivatedDetailStatusServiceMockForDetailPage {
  readonly detect = jest.fn<(runtime: unknown) => Promise<{ isDeactivated: boolean; closedBy: Date | null }>>();
}

class PropertyDetailDomExtractorServiceMockForDetailPage {
  readonly extractProperty = jest.fn<(runtime: unknown, url: string) => Promise<Property | null>>();
  readonly filterPropertyImagesByBlurPattern = jest.fn<(property: Property) => Property>();
}

class PropertyDetailStorageServiceMockForDetailPage {
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

function createService() {
  const cookie = new CookieApprovalDialogScraperServiceMockForDetailPage();
  const navigation = new PropertyDetailNavigationServiceMockForDetailPage();
  const interaction = new PropertyDetailInteractionServiceMockForDetailPage();
  const deactivated = new DeactivatedDetailStatusServiceMockForDetailPage();
  const extractor = new PropertyDetailDomExtractorServiceMockForDetailPage();
  const storage = new PropertyDetailStorageServiceMockForDetailPage();

  const service = new PropertyDetailPageService(
    cookie as unknown as CookieApprovalDialogScraperService,
    navigation as unknown as PropertyDetailNavigationService,
    interaction as unknown as PropertyDetailInteractionService,
    deactivated as unknown as DeactivatedDetailStatusService,
    extractor as unknown as PropertyDetailDomExtractorService,
    storage as unknown as PropertyDetailStorageService
  );

  return { service, cookie, navigation, interaction, deactivated, extractor, storage };
}

describe('PropertyDetailPageService', () => {
  it('whenPropertyLinkIsNotPresent_loadPropertyUrl_shouldThrowAndSkipBackNavigation', async () => {
    // Arrange
    const { service, navigation } = createService();
    const client = createClient();
    navigation.clickPropertyLinkFromResults.mockResolvedValue(false);
    // Action
    const action = service.loadPropertyUrl(client, 'https://www.idealista.com/inmueble/1/');
    // Assert
    await expect(action).rejects.toThrow('Property URL is not visible in current results DOM and cannot be clicked: https://www.idealista.com/inmueble/1/');
    expect(navigation.goBackToSearchResults).not.toHaveBeenCalled();
  });

  it('whenLoadedDetailIsDeactivated_loadPropertyUrl_shouldMarkClosedAndNavigateBack', async () => {
    // Arrange
    const { service, navigation, interaction, cookie, deactivated, storage, extractor } = createService();
    const client = createClient();
    navigation.clickPropertyLinkFromResults.mockResolvedValue(true);
    navigation.waitForDetailUrlAndDomComplete.mockResolvedValue(undefined);
    navigation.goBackToSearchResults.mockResolvedValue(undefined);
    interaction.throwIfOriginErrorPage.mockResolvedValue(undefined);
    cookie.acceptCookiesIfVisible.mockResolvedValue(undefined);
    deactivated.detect.mockResolvedValue({ isDeactivated: true, closedBy: new Date('2026-02-01T00:00:00.000Z') });
    storage.markPropertyClosed.mockResolvedValue(undefined);
    // Action
    await service.loadPropertyUrl(client, 'https://www.idealista.com/inmueble/2/');
    // Assert
    expect(storage.markPropertyClosed).toHaveBeenCalledWith('https://www.idealista.com/inmueble/2/', new Date('2026-02-01T00:00:00.000Z'));
    expect(extractor.extractProperty).not.toHaveBeenCalled();
    expect(navigation.goBackToSearchResults).toHaveBeenCalledWith(client.Runtime);
  });

  it('whenLoadedDetailIsDeactivatedWithoutClosedDate_loadPropertyUrl_shouldMarkClosedWithUndefinedDate', async () => {
    // Arrange
    const { service, navigation, interaction, cookie, deactivated, storage } = createService();
    const client = createClient();
    navigation.clickPropertyLinkFromResults.mockResolvedValue(true);
    navigation.waitForDetailUrlAndDomComplete.mockResolvedValue(undefined);
    navigation.goBackToSearchResults.mockResolvedValue(undefined);
    interaction.throwIfOriginErrorPage.mockResolvedValue(undefined);
    cookie.acceptCookiesIfVisible.mockResolvedValue(undefined);
    deactivated.detect.mockResolvedValue({ isDeactivated: true, closedBy: null });
    storage.markPropertyClosed.mockResolvedValue(undefined);
    // Action
    await service.loadPropertyUrl(client, 'https://www.idealista.com/inmueble/2b/');
    // Assert
    expect(storage.markPropertyClosed).toHaveBeenCalledWith('https://www.idealista.com/inmueble/2b/', undefined);
    expect(navigation.goBackToSearchResults).toHaveBeenCalledWith(client.Runtime);
  });

  it('whenDetailIsActiveAndExtracted_loadPropertyUrl_shouldFilterAndPersistProperty', async () => {
    // Arrange
    const { service, navigation, interaction, cookie, deactivated, extractor, storage } = createService();
    const client = createClient();
    const rawProperty = createProperty('https://www.idealista.com/inmueble/3/');
    const filteredProperty = createProperty('https://www.idealista.com/inmueble/3/');
    navigation.clickPropertyLinkFromResults.mockResolvedValue(true);
    navigation.waitForDetailUrlAndDomComplete.mockResolvedValue(undefined);
    navigation.goBackToSearchResults.mockResolvedValue(undefined);
    interaction.throwIfOriginErrorPage.mockResolvedValue(undefined);
    interaction.revealDetailMedia.mockResolvedValue(undefined);
    cookie.acceptCookiesIfVisible.mockResolvedValue(undefined);
    deactivated.detect.mockResolvedValue({ isDeactivated: false, closedBy: null });
    extractor.extractProperty.mockResolvedValue(rawProperty);
    extractor.filterPropertyImagesByBlurPattern.mockReturnValue(filteredProperty);
    storage.savePropertyWithImages.mockResolvedValue(undefined);
    // Action
    await service.loadPropertyUrl(client, 'https://www.idealista.com/inmueble/3/');
    // Assert
    expect(interaction.revealDetailMedia).toHaveBeenCalledWith(client.Runtime);
    expect(extractor.filterPropertyImagesByBlurPattern).toHaveBeenCalledWith(rawProperty);
    expect(storage.savePropertyWithImages).toHaveBeenCalledWith(filteredProperty);
  });

  it('whenExtractionFailsAndStillActive_loadPropertyUrlFromDatabase_shouldThrowAndNavigateBack', async () => {
    // Arrange
    const { service, navigation, interaction, cookie, deactivated, extractor } = createService();
    const client = createClient();
    navigation.navigateDirectlyToUrl.mockResolvedValue(undefined);
    navigation.goBackToSearchResults.mockResolvedValue(undefined);
    interaction.throwIfOriginErrorPage.mockResolvedValue(undefined);
    interaction.revealDetailMedia.mockResolvedValue(undefined);
    cookie.acceptCookiesIfVisible.mockResolvedValue(undefined);
    deactivated.detect
      .mockResolvedValueOnce({ isDeactivated: false, closedBy: null })
      .mockResolvedValueOnce({ isDeactivated: false, closedBy: null });
    extractor.extractProperty.mockResolvedValue(null);
    // Action
    const action = service.loadPropertyUrlFromDatabase(client, 'https://www.idealista.com/inmueble/4/');
    // Assert
    await expect(action).rejects.toThrow('Property detail container was not found after loading URL: https://www.idealista.com/inmueble/4/');
    expect(navigation.goBackToSearchResults).toHaveBeenCalledWith(client.Runtime);
  });

  it('whenExtractionFailsAndThenDeactivated_loadPropertyUrlFromDatabase_shouldMarkClosed', async () => {
    // Arrange
    const { service, navigation, interaction, cookie, deactivated, extractor, storage } = createService();
    const client = createClient();
    const closedBy = new Date('2026-02-02T00:00:00.000Z');
    navigation.navigateDirectlyToUrl.mockResolvedValue(undefined);
    navigation.goBackToSearchResults.mockResolvedValue(undefined);
    interaction.throwIfOriginErrorPage.mockResolvedValue(undefined);
    interaction.revealDetailMedia.mockResolvedValue(undefined);
    cookie.acceptCookiesIfVisible.mockResolvedValue(undefined);
    deactivated.detect
      .mockResolvedValueOnce({ isDeactivated: false, closedBy: null })
      .mockResolvedValueOnce({ isDeactivated: true, closedBy });
    extractor.extractProperty.mockResolvedValue(null);
    storage.markPropertyClosed.mockResolvedValue(undefined);
    // Action
    await service.loadPropertyUrlFromDatabase(client, 'https://www.idealista.com/inmueble/5/');
    // Assert
    expect(storage.markPropertyClosed).toHaveBeenCalledWith('https://www.idealista.com/inmueble/5/', closedBy);
    expect(navigation.goBackToSearchResults).toHaveBeenCalledWith(client.Runtime);
  });

  it('whenExtractionFailsAndThenDeactivatedWithoutClosedDate_loadPropertyUrlFromDatabase_shouldMarkClosedWithUndefinedDate', async () => {
    // Arrange
    const { service, navigation, interaction, cookie, deactivated, extractor, storage } = createService();
    const client = createClient();
    navigation.navigateDirectlyToUrl.mockResolvedValue(undefined);
    navigation.goBackToSearchResults.mockResolvedValue(undefined);
    interaction.throwIfOriginErrorPage.mockResolvedValue(undefined);
    interaction.revealDetailMedia.mockResolvedValue(undefined);
    cookie.acceptCookiesIfVisible.mockResolvedValue(undefined);
    deactivated.detect
      .mockResolvedValueOnce({ isDeactivated: false, closedBy: null })
      .mockResolvedValueOnce({ isDeactivated: true, closedBy: null });
    extractor.extractProperty.mockResolvedValue(null);
    storage.markPropertyClosed.mockResolvedValue(undefined);
    // Action
    await service.loadPropertyUrlFromDatabase(client, 'https://www.idealista.com/inmueble/5b/');
    // Assert
    expect(storage.markPropertyClosed).toHaveBeenCalledWith('https://www.idealista.com/inmueble/5b/', undefined);
    expect(navigation.goBackToSearchResults).toHaveBeenCalledWith(client.Runtime);
  });

  it('whenDirectNavigationFails_loadPropertyUrlFromDatabase_shouldAlwaysReturnToSearchResults', async () => {
    // Arrange
    const { service, navigation } = createService();
    const client = createClient();
    navigation.navigateDirectlyToUrl.mockRejectedValue(new Error('navigation failed'));
    navigation.goBackToSearchResults.mockResolvedValue(undefined);
    // Action
    const action = service.loadPropertyUrlFromDatabase(client, 'https://www.idealista.com/inmueble/6/');
    // Assert
    await expect(action).rejects.toThrow('navigation failed');
    expect(navigation.goBackToSearchResults).toHaveBeenCalledWith(client.Runtime);
  });
});
