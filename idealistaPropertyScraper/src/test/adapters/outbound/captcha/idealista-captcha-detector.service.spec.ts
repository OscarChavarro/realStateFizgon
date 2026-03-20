import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { IdealistaCaptchaDetectorService as SdkIdealistaCaptchaDetectorService } from '@real-state-fizgon/captcha-solvers';
import { IdealistaCaptchaDetectorService } from 'adapters/outbound/captcha/idealista-captcha-detector.service';

describe('IdealistaCaptchaDetectorService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('whenPanicIfCaptchaDetectedIsRequested_panicIfCaptchaDetected_shouldDelegateToSdkService', async () => {
    // Arrange
    const service = new IdealistaCaptchaDetectorService();
    const request = {
      runtime: {
        evaluate: jest.fn(async () => ({ result: { value: false } }))
      },
      context: 'search results page',
      waitMs: 123
    };
    const sdkSpy = jest
      .spyOn(SdkIdealistaCaptchaDetectorService.prototype, 'panicIfCaptchaDetected')
      .mockResolvedValue(undefined);
    // Action
    await service.panicIfCaptchaDetected(request);
    // Assert
    expect(sdkSpy).toHaveBeenCalledWith(request);
  });
});
