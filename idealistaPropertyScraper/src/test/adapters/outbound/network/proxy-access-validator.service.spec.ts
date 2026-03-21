import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { ProxyService } from '@real-state-fizgon/proxy';
import { ProxyAccessValidatorService } from 'adapters/outbound/network/proxy-access-validator.service';

describe('ProxyAccessValidatorService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('whenProxyIsEnabled_validateProxyAccessOrWait_shouldDelegateToSdkAndReturnValidatedResult', async () => {
    // Arrange
    const service = new ProxyAccessValidatorService();
    const logger = {
      log: jest.fn<(message: string) => void>(),
      error: jest.fn<(message: string) => void>()
    };
    (service as unknown as { logger: typeof logger }).logger = logger;
    const request = {
      enabled: true,
      host: '127.0.0.1',
      port: 8080,
      retryWaitMs: 5000
    };
    const sdkSpy = jest.spyOn(ProxyService.prototype, 'validateProxyAccessOrWait').mockImplementation(async (options: {
      logger?: { log(message: string): void; error(message: string): void };
    }) => {
      options.logger?.log('sdk-log');
      options.logger?.error('sdk-error');
    });
    // Action
    const result = await service.validateProxyAccessOrWait(request);
    // Assert
    expect(sdkSpy).toHaveBeenCalledWith(expect.objectContaining({
      ...request,
      logger: expect.any(Object)
    }));
    expect(result).toEqual({
      status: 'proxy_validated',
      enabled: true,
      host: '127.0.0.1',
      port: 8080
    });
    expect(logger.log).toHaveBeenCalledWith('sdk-log');
    expect(logger.error).toHaveBeenCalledWith('sdk-error');
  });

  it('whenProxyIsDisabled_validateProxyAccessOrWait_shouldReturnDisabledResult', async () => {
    // Arrange
    const service = new ProxyAccessValidatorService();
    const request = {
      enabled: false,
      host: '127.0.0.1',
      port: 8080,
      retryWaitMs: 5000
    };
    const sdkSpy = jest.spyOn(ProxyService.prototype, 'validateProxyAccessOrWait').mockResolvedValue(undefined);
    // Action
    const result = await service.validateProxyAccessOrWait(request);
    // Assert
    expect(sdkSpy).toHaveBeenCalledWith(expect.objectContaining({
      ...request,
      logger: expect.any(Object)
    }));
    expect(result).toEqual({
      status: 'proxy_disabled',
      enabled: false
    });
  });
});
