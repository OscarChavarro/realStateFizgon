import { Injectable } from '@nestjs/common';
import { IdealistaCaptchaDetectorService as SdkIdealistaCaptchaDetectorService } from '@real-state-fizgon/captcha-solvers';

import type { CaptchaDetectionRequest, CaptchaDetectorPort } from 'ports/outbound/captcha/captcha-detector.port';

@Injectable()
export class IdealistaCaptchaDetectorService implements CaptchaDetectorPort {
  private readonly sdkService = new SdkIdealistaCaptchaDetectorService();

  async panicIfCaptchaDetected(request: CaptchaDetectionRequest): Promise<void> {
    await this.sdkService.panicIfCaptchaDetected(request);
  }
}
