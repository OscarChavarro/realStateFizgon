import { Injectable, Logger } from '@nestjs/common';
import { IdealistaCaptchaDetectorService } from '@real-state-fizgon/captcha-solvers';
import { CookieApprovalDialogScraperService } from 'src/application/services/scraper/property/cookie-approval-dialog-scraper.service';
import { PropertyDetailInteractionService } from 'src/application/services/scraper/property/property-detail-interaction.service';
import { PropertyDetailStorageService } from 'src/application/services/scraper/property/property-detail-storage.service';
import { ExtractAndEnrichPropertyDetailUseCase } from 'src/application/usecases/scraper/extract-and-enrich-property-detail.use-case';
import { HandleDeactivatedPropertyDetailUseCase } from 'src/application/usecases/scraper/handle-deactivated-property-detail.use-case';

import type { PropertyCdpClient } from 'src/application/services/scraper/property/cdp-client.type';
@Injectable()
export class ProcessLoadedPropertyDetailUseCase {
  private readonly logger = new Logger(ProcessLoadedPropertyDetailUseCase.name);
  private readonly captchaDetectorService = new IdealistaCaptchaDetectorService();

  constructor(
    private readonly cookieApprovalDialogScraperService: CookieApprovalDialogScraperService,
    private readonly interactionService: PropertyDetailInteractionService,
    private readonly handleDeactivatedPropertyDetailUseCase: HandleDeactivatedPropertyDetailUseCase,
    private readonly extractAndEnrichPropertyDetailUseCase: ExtractAndEnrichPropertyDetailUseCase,
    private readonly storageService: PropertyDetailStorageService
  ) {}

  async execute(
    client: PropertyCdpClient,
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

    const wasHandledAsDeactivatedBeforeMedia = await this.handleDeactivatedPropertyDetailUseCase.execute(
      client.Runtime,
      url
    );
    if (wasHandledAsDeactivatedBeforeMedia) {
      return;
    }

    await this.interactionService.revealDetailMedia(client.Runtime);

    const enrichedProperty = await this.extractAndEnrichPropertyDetailUseCase.execute(
      client.Runtime,
      url,
      geoHintMode
    );
    if (!enrichedProperty) {
      return;
    }

    await this.storageService.savePropertyWithImages(enrichedProperty);
  }
}
