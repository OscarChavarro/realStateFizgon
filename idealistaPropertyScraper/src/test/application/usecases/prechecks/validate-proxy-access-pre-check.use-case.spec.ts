import { describe, expect, it, jest } from '@jest/globals';
import { ValidateProxyAccessPreCheckUseCase } from 'application/usecases/prechecks/validate-proxy-access-pre-check.use-case';
import { ChromeConfig } from 'infrastructure/config/settings/chrome.config';

type ProxyValidationArgs = {
  enabled: boolean;
  host: string;
  port: number;
  retryWaitMs: number;
  logger: unknown;
};

class ProxyServiceMockForValidateProxyAccessPreCheckUseCase {
  readonly validateProxyAccessOrWait = jest.fn<(args: ProxyValidationArgs) => Promise<void>>();
}

function createUseCase() {
  const chromeConfig = {
    proxyEnabled: true,
    proxyHost: '127.0.0.1',
    proxyPort: 8080,
    chromeBrowserLaunchRetryWaitMs: 5000
  };
  const useCase = new ValidateProxyAccessPreCheckUseCase(chromeConfig as unknown as ChromeConfig);
  const proxyService = new ProxyServiceMockForValidateProxyAccessPreCheckUseCase();
  Object.defineProperty(useCase as unknown as { proxyService: unknown }, 'proxyService', {
    value: proxyService
  });

  return {
    useCase,
    chromeConfig,
    proxyService
  };
}

describe('ValidateProxyAccessPreCheckUseCase', () => {
  it('whenProxyIsConfigured_execute_shouldValidateProxyAccessWithConfiguredValues', async () => {
    // Arrange
    const { useCase, chromeConfig, proxyService } = createUseCase();
    proxyService.validateProxyAccessOrWait.mockResolvedValue(undefined);
    // Action
    await useCase.execute();
    // Assert
    expect(proxyService.validateProxyAccessOrWait).toHaveBeenCalledTimes(1);
    expect(proxyService.validateProxyAccessOrWait).toHaveBeenCalledWith({
      enabled: chromeConfig.proxyEnabled,
      host: chromeConfig.proxyHost,
      port: chromeConfig.proxyPort,
      retryWaitMs: chromeConfig.chromeBrowserLaunchRetryWaitMs,
      logger: expect.any(Object)
    });
  });

  it('whenProxyValidationFails_execute_shouldPropagateError', async () => {
    // Arrange
    const { useCase, proxyService } = createUseCase();
    proxyService.validateProxyAccessOrWait.mockRejectedValue(new Error('proxy unavailable'));
    // Action
    const action = useCase.execute();
    // Assert
    await expect(action).rejects.toThrow('proxy unavailable');
  });
});
