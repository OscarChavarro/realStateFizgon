import { Inject, Injectable, Logger } from '@nestjs/common';
import { CookieApprovalDialogScraperService } from 'application/services/scraper/property/cookie-approval-dialog-scraper.service';
import { PropertyDetailInteractionService } from 'application/services/scraper/property/property-detail-interaction.service';
import { ExtractAndEnrichPropertyDetailUseCase } from 'application/usecases/scraper/extract-and-enrich-property-detail.use-case';
import { HandleDeactivatedPropertyDetailUseCase } from 'application/usecases/scraper/handle-deactivated-property-detail.use-case';
import { PersistPropertyDetailAndAssetsUseCase } from 'application/usecases/scraper/persist-property-detail-and-assets.use-case';
import { CAPTCHA_DETECTOR_PORT } from 'ports/outbound/captcha/captcha-detector.port.token';

import type { CaptchaDetectorPort } from 'ports/outbound/captcha/captcha-detector.port';
import type { PropertyCdpClient } from 'ports/outbound/browser/property-cdp-client.port';
@Injectable()
export class ProcessLoadedPropertyDetailUseCase {
  private readonly logger = new Logger(ProcessLoadedPropertyDetailUseCase.name);

  constructor(
    private readonly cookieApprovalDialogScraperService: CookieApprovalDialogScraperService,
    private readonly interactionService: PropertyDetailInteractionService,
    private readonly handleDeactivatedPropertyDetailUseCase: HandleDeactivatedPropertyDetailUseCase,
    private readonly extractAndEnrichPropertyDetailUseCase: ExtractAndEnrichPropertyDetailUseCase,
    private readonly persistPropertyDetailAndAssetsUseCase: PersistPropertyDetailAndAssetsUseCase,
    @Inject(CAPTCHA_DETECTOR_PORT)
    private readonly captchaDetectorPort: CaptchaDetectorPort
  ) {}

  async execute(
    client: PropertyCdpClient,
    url: string,
    geoHintMode: 'ALWAYS' | 'ONLY_WHEN_MISSING_IN_DB'
  ): Promise<void> {
    await this.captchaDetectorPort.panicIfCaptchaDetected({
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

    await this.persistPropertyDetailAndAssetsUseCase.execute(enrichedProperty);
  }
}
