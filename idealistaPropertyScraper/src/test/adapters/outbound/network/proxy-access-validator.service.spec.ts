import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { ProxyService } from '@real-state-fizgon/proxy';
import { ProxyAccessValidatorService } from 'adapters/outbound/network/proxy-access-validator.service';

describe('ProxyAccessValidatorService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('whenValidateProxyAccessOrWaitIsRequested_validateProxyAccessOrWait_shouldDelegateToSdkService', async () => {
    // Arrange
    const service = new ProxyAccessValidatorService();
    const request = {
      enabled: true,
      host: '127.0.0.1',
      port: 8080,
      retryWaitMs: 5000
    };
    const sdkSpy = jest.spyOn(ProxyService.prototype, 'validateProxyAccessOrWait').mockResolvedValue(undefined);
    // Action
    await service.validateProxyAccessOrWait(request);
    // Assert
    expect(sdkSpy).toHaveBeenCalledWith(request);
  });
});
