import { Module } from '@nestjs/common';
import { IdealistaCaptchaDetectorService } from 'adapters/outbound/captcha/idealista-captcha-detector.service';
import { CAPTCHA_DETECTOR_PORT } from 'ports/outbound/captcha/captcha-detector.port.token';

@Module({
  providers: [
    IdealistaCaptchaDetectorService,
    {
      provide: CAPTCHA_DETECTOR_PORT,
      useExisting: IdealistaCaptchaDetectorService
    }
  ],
  exports: [IdealistaCaptchaDetectorService, CAPTCHA_DETECTOR_PORT]
})
export class IdealistaCaptchaDetectorModule {}
