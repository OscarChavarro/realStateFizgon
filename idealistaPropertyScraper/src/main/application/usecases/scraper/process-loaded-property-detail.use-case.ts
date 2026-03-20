import { Injectable, Logger } from '@nestjs/common';
import { IdealistaCaptchaDetectorService } from '@real-state-fizgon/captcha-solvers';
import { CookieApprovalDialogScraperService } from 'src/application/services/scraper/property/cookie-approval-dialog-scraper.service';
import { CdpClient } from 'src/application/services/scraper/property/cdp-client.type';
import { DeactivatedDetailStatusService } from 'src/application/services/scraper/property/deactivated-detail-status.service';
import { GeoCoordinateHintService } from 'src/application/services/scraper/property/geo-coordinate-hint.service';
import { PropertyDetailDomExtractorService } from 'src/application/services/scraper/property/property-detail-dom-extractor.service';
import { PropertyDetailInteractionService } from 'src/application/services/scraper/property/property-detail-interaction.service';
import { PropertyDetailStorageService } from 'src/application/services/scraper/property/property-detail-storage.service';

@Injectable()
export class ProcessLoadedPropertyDetailUseCase {
  private readonly logger = new Logger(ProcessLoadedPropertyDetailUseCase.name);
  private readonly captchaDetectorService = new IdealistaCaptchaDetectorService();

  constructor(
    private readonly cookieApprovalDialogScraperService: CookieApprovalDialogScraperService,
    private readonly interactionService: PropertyDetailInteractionService,
    private readonly deactivatedDetailStatusService: DeactivatedDetailStatusService,
    private readonly domExtractorService: PropertyDetailDomExtractorService,
    private readonly geoCoordinateHintService: GeoCoordinateHintService,
    private readonly storageService: PropertyDetailStorageService
  ) {}

  async execute(
    client: CdpClient,
    url: string,
    geoHintMode: 'ALWAYS' | 'ONLY_WHEN_MISSING_IN_DB'
  ): Promise<void> {
    await this.captchaDetectorService.panicIfCaptchaDetected({
      runtime: client.Runtime,
      logger: this.logger,
      context: `property detail url "${url}"`
    });

    await this.interactionService.throwIfOriginErrorPage(client.Runtime);
    await this.cookieApprovalDialogScraperService.acceptCookiesIfVisible(client.Runtime);

    const deactivatedStatus = await this.deactivatedDetailStatusService.detect(client.Runtime);
    if (deactivatedStatus.isDeactivated) {
      await this.storageService.markPropertyClosed(url, deactivatedStatus.closedBy ?? undefined);
      return;
    }

    await this.interactionService.revealDetailMedia(client.Runtime);

    const extractedProperty = await this.domExtractorService.extractProperty(client.Runtime, url);
    if (!extractedProperty) {
      const afterExtractionStatus = await this.deactivatedDetailStatusService.detect(client.Runtime);
      if (afterExtractionStatus.isDeactivated) {
        await this.storageService.markPropertyClosed(url, afterExtractionStatus.closedBy ?? undefined);
        return;
      }

      throw new Error(`Property detail container was not found after loading URL: ${url}`);
    }

    const filteredProperty = this.domExtractorService.filterPropertyImagesByBlurPattern(extractedProperty);
    const enrichedProperty = await this.geoCoordinateHintService.enrichProperty(
      client.Runtime,
      filteredProperty,
      geoHintMode
    );
    await this.storageService.savePropertyWithImages(enrichedProperty);
  }
}
