import { Injectable, Logger } from '@nestjs/common';
import { IdealistaCaptchaDetectorService } from '@real-state-fizgon/captcha-solvers';
import { CookieAprovalDialogScraperService } from './cookie-aproval-dialog-scraper.service';
import { CdpClient } from './cdp-client.types';
import { PropertyDetailDomExtractorService } from './property-detail-dom-extractor.service';
import { PropertyDetailInteractionService } from './property-detail-interaction.service';
import { PropertyDetailNavigationService } from './property-detail-navigation.service';
import { PropertyDetailStorageService } from './property-detail-storage.service';

@Injectable()
export class PropertyDetailPageService {
  private readonly logger = new Logger(PropertyDetailPageService.name);
  private readonly captchaDetectorService = new IdealistaCaptchaDetectorService();

  constructor(
    private readonly cookieAprovalDialogScraperService: CookieAprovalDialogScraperService,
    private readonly navigationService: PropertyDetailNavigationService,
    private readonly interactionService: PropertyDetailInteractionService,
    private readonly domExtractorService: PropertyDetailDomExtractorService,
    private readonly storageService: PropertyDetailStorageService
  ) {}

  async loadPropertyUrl(client: CdpClient, url: string): Promise<void> {
    const clicked = await this.navigationService.clickPropertyLinkFromResults(client.Runtime, url);
    if (!clicked) {
      throw new Error(`Property URL is not visible in current results DOM and cannot be clicked: ${url}`);
    }

    try {
      await this.navigationService.waitForDetailUrlAndDomComplete(client.Runtime, url);
      await this.processLoadedPropertyDetail(client, url);
    } finally {
      await this.navigationService.goBackToSearchResults(client.Runtime);
    }
  }

  async loadPropertyUrlFromDatabase(client: CdpClient, url: string): Promise<void> {
    try {
      await this.navigationService.navigateDirectlyToUrl(client.Runtime, url);
      await this.processLoadedPropertyDetail(client, url);
    } finally {
      await this.navigationService.goBackToSearchResults(client.Runtime);
    }
  }

  private async processLoadedPropertyDetail(client: CdpClient, url: string): Promise<void> {
    await this.captchaDetectorService.panicIfCaptchaDetected({
      runtime: client.Runtime,
      logger: this.logger,
      context: `property detail url "${url}"`
    });

    await this.interactionService.throwIfOriginErrorPage(client.Runtime);
    await this.cookieAprovalDialogScraperService.acceptCookiesIfVisible(client.Runtime);

    if (await this.interactionService.isDeactivatedDetailPage(client.Runtime)) {
      await this.storageService.markPropertyClosed(url);
      return;
    }

    await this.interactionService.revealDetailMedia(client.Runtime);

    const extractedProperty = await this.domExtractorService.extractProperty(client.Runtime, url);
    if (!extractedProperty) {
      if (await this.interactionService.isDeactivatedDetailPage(client.Runtime)) {
        await this.storageService.markPropertyClosed(url);
        return;
      }

      throw new Error(`Property detail container was not found after loading URL: ${url}`);
    }

    const filteredProperty = this.domExtractorService.filterPropertyImagesByBlurPattern(extractedProperty);
    await this.storageService.savePropertyWithImages(filteredProperty);
  }
}
