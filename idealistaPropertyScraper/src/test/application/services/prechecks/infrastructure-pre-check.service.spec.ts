import { describe, expect, it, jest } from '@jest/globals';
import { ImageDownloader } from 'src/application/services/imagedownload/image-downloader';
import { InfrastructurePreCheckService } from 'src/application/services/prechecks/infrastructure-pre-check.service';
import { ChromeConfig } from 'src/infrastructure/config/settings/chrome.config';
import { PropertyPersistencePort } from 'src/ports/outbound/persistence/property-persistence.port';
import { PropertyPersistencePortMock } from '../../../ports/outbound/persistence/property-persistence-port.mock';

type ProxyValidationArgs = {
  enabled: boolean;
  host: string;
  port: number;
  retryWaitMs: number;
  logger: unknown;
};

class ProxyServiceMockForInfrastructurePreCheckService {
  readonly validateProxyAccessOrWait = jest.fn<(args: ProxyValidationArgs) => Promise<void>>();
}

class ImageDownloaderMockForInfrastructurePreCheckService {
  readonly validateImageDownloadFolder = jest.fn<() => Promise<void>>();
}

function createService() {
  const chromeConfig = {
    proxyEnabled: true,
    proxyHost: '127.0.0.1',
    proxyPort: 8080,
    chromeBrowserLaunchRetryWaitMs: 5000
  };
  const propertyPersistencePort = new PropertyPersistencePortMock();
  const imageDownloader = new ImageDownloaderMockForInfrastructurePreCheckService();
  const service = new InfrastructurePreCheckService(
    chromeConfig as unknown as ChromeConfig,
    propertyPersistencePort as unknown as PropertyPersistencePort,
    imageDownloader as unknown as ImageDownloader
  );
  const proxyService = new ProxyServiceMockForInfrastructurePreCheckService();
  Object.defineProperty(service as unknown as { proxyService: unknown }, 'proxyService', {
    value: proxyService
  });

  return {
    service,
    chromeConfig,
    proxyService,
    propertyPersistencePort,
    imageDownloader
  };
}

describe('InfrastructurePreCheckService', () => {
  it('whenAllPreChecksPass_runBeforeScraperStartup_shouldValidateProxyMongoAndImageFolderInOrder', async () => {
    // Arrange
    const { service, chromeConfig, proxyService, propertyPersistencePort, imageDownloader } = createService();
    proxyService.validateProxyAccessOrWait.mockResolvedValue(undefined);
    propertyPersistencePort.validateConnectionOrExit.mockResolvedValue(undefined);
    imageDownloader.validateImageDownloadFolder.mockResolvedValue(undefined);
    // Action
    await service.runBeforeScraperStartup();
    // Assert
    expect(proxyService.validateProxyAccessOrWait).toHaveBeenCalledTimes(1);
    expect(proxyService.validateProxyAccessOrWait).toHaveBeenCalledWith({
      enabled: chromeConfig.proxyEnabled,
      host: chromeConfig.proxyHost,
      port: chromeConfig.proxyPort,
      retryWaitMs: chromeConfig.chromeBrowserLaunchRetryWaitMs,
      logger: expect.any(Object)
    });
    expect(propertyPersistencePort.validateConnectionOrExit).toHaveBeenCalledTimes(1);
    expect(imageDownloader.validateImageDownloadFolder).toHaveBeenCalledTimes(1);
    const proxyCallOrder = proxyService.validateProxyAccessOrWait.mock.invocationCallOrder[0];
    const mongoCallOrder = propertyPersistencePort.validateConnectionOrExit.mock.invocationCallOrder[0];
    const imageCallOrder = imageDownloader.validateImageDownloadFolder.mock.invocationCallOrder[0];
    expect(proxyCallOrder).toBeLessThan(mongoCallOrder);
    expect(mongoCallOrder).toBeLessThan(imageCallOrder);
  });

  it('whenProxyValidationFails_runBeforeScraperStartup_shouldPropagateErrorAndSkipMongoAndImageChecks', async () => {
    // Arrange
    const { service, proxyService, propertyPersistencePort, imageDownloader } = createService();
    proxyService.validateProxyAccessOrWait.mockRejectedValue(new Error('proxy failed'));
    // Action
    const action = service.runBeforeScraperStartup();
    // Assert
    await expect(action).rejects.toThrow('proxy failed');
    expect(propertyPersistencePort.validateConnectionOrExit).not.toHaveBeenCalled();
    expect(imageDownloader.validateImageDownloadFolder).not.toHaveBeenCalled();
  });

  it('whenMongoValidationFails_runBeforeScraperStartup_shouldPropagateErrorAndSkipImageCheck', async () => {
    // Arrange
    const { service, proxyService, propertyPersistencePort, imageDownloader } = createService();
    proxyService.validateProxyAccessOrWait.mockResolvedValue(undefined);
    propertyPersistencePort.validateConnectionOrExit.mockRejectedValue(new Error('mongo failed'));
    // Action
    const action = service.runBeforeScraperStartup();
    // Assert
    await expect(action).rejects.toThrow('mongo failed');
    expect(proxyService.validateProxyAccessOrWait).toHaveBeenCalledTimes(1);
    expect(imageDownloader.validateImageDownloadFolder).not.toHaveBeenCalled();
  });

  it('whenImageFolderValidationFails_runBeforeScraperStartup_shouldPropagateErrorAfterPreviousChecks', async () => {
    // Arrange
    const { service, proxyService, propertyPersistencePort, imageDownloader } = createService();
    proxyService.validateProxyAccessOrWait.mockResolvedValue(undefined);
    propertyPersistencePort.validateConnectionOrExit.mockResolvedValue(undefined);
    imageDownloader.validateImageDownloadFolder.mockRejectedValue(new Error('image folder failed'));
    // Action
    const action = service.runBeforeScraperStartup();
    // Assert
    await expect(action).rejects.toThrow('image folder failed');
    expect(proxyService.validateProxyAccessOrWait).toHaveBeenCalledTimes(1);
    expect(propertyPersistencePort.validateConnectionOrExit).toHaveBeenCalledTimes(1);
    expect(imageDownloader.validateImageDownloadFolder).toHaveBeenCalledTimes(1);
  });
});
