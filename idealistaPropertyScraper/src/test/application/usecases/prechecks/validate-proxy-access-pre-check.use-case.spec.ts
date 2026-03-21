import { describe, expect, it, jest } from '@jest/globals';
import { ValidateProxyAccessPreCheckUseCase } from 'application/usecases/prechecks/validate-proxy-access-pre-check.use-case';
import { ChromeConfig } from 'infrastructure/config/settings/chrome.config';

import type { ProxyAccessValidatorPort } from 'ports/outbound/network/proxy-access-validator.port';

class ProxyAccessValidatorPortMockForValidateProxyAccessPreCheckUseCase implements ProxyAccessValidatorPort {
  readonly validateProxyAccessOrWait: jest.MockedFunction<ProxyAccessValidatorPort['validateProxyAccessOrWait']> =
    jest.fn();
}

function createUseCase() {
  const chromeConfig = {
    proxyEnabled: true,
    proxyHost: '127.0.0.1',
    proxyPort: 8080,
    chromeBrowserLaunchRetryWaitMs: 5000
  };
  const proxyAccessValidatorPort = new ProxyAccessValidatorPortMockForValidateProxyAccessPreCheckUseCase();
  proxyAccessValidatorPort.validateProxyAccessOrWait.mockResolvedValue({
    status: 'proxy_validated',
    enabled: true,
    host: chromeConfig.proxyHost,
    port: chromeConfig.proxyPort
  });
  const useCase = new ValidateProxyAccessPreCheckUseCase(
    chromeConfig as unknown as ChromeConfig,
    proxyAccessValidatorPort
  );
  const logger = {
    log: jest.fn<(message: string) => void>(),
    warn: jest.fn<(message: string) => void>(),
    error: jest.fn<(message: string) => void>()
  };
  (useCase as unknown as { logger: typeof logger }).logger = logger;

  return {
    useCase,
    chromeConfig,
    proxyAccessValidatorPort,
    logger
  };
}

describe('ValidateProxyAccessPreCheckUseCase', () => {
  it('whenProxyIsConfigured_execute_shouldValidateProxyAccessWithConfiguredValues', async () => {
    // Arrange
    const { useCase, chromeConfig, proxyAccessValidatorPort, logger } = createUseCase();
    // Action
    await useCase.execute();
    // Assert
    expect(proxyAccessValidatorPort.validateProxyAccessOrWait).toHaveBeenCalledTimes(1);
    expect(proxyAccessValidatorPort.validateProxyAccessOrWait).toHaveBeenCalledWith({
      enabled: chromeConfig.proxyEnabled,
      host: chromeConfig.proxyHost,
      port: chromeConfig.proxyPort,
      retryWaitMs: chromeConfig.chromeBrowserLaunchRetryWaitMs
    });
    expect(logger.log).toHaveBeenCalledWith(
      'Proxy validation completed: proxy connectivity available for 127.0.0.1:8080.'
    );
  });

  it('whenProxyValidationFails_execute_shouldPropagateError', async () => {
    // Arrange
    const { useCase, proxyAccessValidatorPort } = createUseCase();
    proxyAccessValidatorPort.validateProxyAccessOrWait.mockRejectedValue(new Error('proxy unavailable'));
    // Action
    const action = useCase.execute();
    // Assert
    await expect(action).rejects.toThrow('proxy unavailable');
  });

  it('whenProxyIsDisabled_execute_shouldLogDisabledValidationResult', async () => {
    // Arrange
    const { useCase, proxyAccessValidatorPort, logger } = createUseCase();
    proxyAccessValidatorPort.validateProxyAccessOrWait.mockResolvedValue({
      status: 'proxy_disabled',
      enabled: false
    });
    // Action
    await useCase.execute();
    // Assert
    expect(logger.log).toHaveBeenCalledWith('Proxy validation completed: proxy disabled in configuration.');
  });
});
