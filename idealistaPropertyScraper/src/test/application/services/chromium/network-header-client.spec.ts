import { describe, expect, it, jest } from '@jest/globals';
import { CdpNetworkClient } from 'application/services/chromium/cdp-network-client.type';
import { NetworkHeaderClient } from 'application/services/chromium/network-header-client';

type LoggerMock = {
  warn: jest.Mock<(message: string) => void>;
};

function createLogger(): LoggerMock {
  return {
    warn: jest.fn<(message: string) => void>()
  };
}

describe('NetworkHeaderClient', () => {
  it('whenNetworkDomainExists_hasNetworkDomain_shouldReturnTrue', () => {
    // Arrange
    const client = { Network: {} } as CdpNetworkClient;
    const logger = createLogger();
    const networkHeaderClient = new NetworkHeaderClient(client, logger as never);
    // Action
    const hasDomain = networkHeaderClient.hasNetworkDomain();
    // Assert
    expect(hasDomain).toBe(true);
  });

  it('whenNetworkDomainIsMissing_hasNetworkDomain_shouldReturnFalse', () => {
    // Arrange
    const client = {} as CdpNetworkClient;
    const logger = createLogger();
    const networkHeaderClient = new NetworkHeaderClient(client, logger as never);
    // Action
    const hasDomain = networkHeaderClient.hasNetworkDomain();
    // Assert
    expect(hasDomain).toBe(false);
  });

  it('whenEnableSucceeds_enableNetworkDomain_shouldEnableNetworkDomain', async () => {
    // Arrange
    const enable = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const client = { Network: { enable } } as CdpNetworkClient;
    const logger = createLogger();
    const networkHeaderClient = new NetworkHeaderClient(client, logger as never);
    // Action
    await networkHeaderClient.enableNetworkDomain();
    // Assert
    expect(enable).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('whenEnableFails_enableNetworkDomain_shouldLogWarning', async () => {
    // Arrange
    const enable = jest.fn<() => Promise<void>>().mockRejectedValue(new Error('boom'));
    const client = { Network: { enable } } as CdpNetworkClient;
    const logger = createLogger();
    const networkHeaderClient = new NetworkHeaderClient(client, logger as never);
    // Action
    await networkHeaderClient.enableNetworkDomain();
    // Assert
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to enable Network domain.'));
  });

  it('whenHeadersAndSetterAreAvailable_applyExtraHeaders_shouldApplyHeaders', async () => {
    // Arrange
    const setExtraHTTPHeaders = jest.fn<(params: { headers: Record<string, string> }) => Promise<void>>()
      .mockResolvedValue(undefined);
    const client = { Network: { setExtraHTTPHeaders } } as CdpNetworkClient;
    const logger = createLogger();
    const networkHeaderClient = new NetworkHeaderClient(client, logger as never);
    // Action
    await networkHeaderClient.applyExtraHeaders({ DNT: '1' });
    // Assert
    expect(setExtraHTTPHeaders).toHaveBeenCalledWith({ headers: { DNT: '1' } });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('whenHeadersAreEmpty_applyExtraHeaders_shouldSkipCall', async () => {
    // Arrange
    const setExtraHTTPHeaders = jest.fn<(params: { headers: Record<string, string> }) => Promise<void>>()
      .mockResolvedValue(undefined);
    const client = { Network: { setExtraHTTPHeaders } } as CdpNetworkClient;
    const logger = createLogger();
    const networkHeaderClient = new NetworkHeaderClient(client, logger as never);
    // Action
    await networkHeaderClient.applyExtraHeaders({});
    // Assert
    expect(setExtraHTTPHeaders).not.toHaveBeenCalled();
  });

  it('whenSetterIsMissing_applyExtraHeaders_shouldSkipCall', async () => {
    // Arrange
    const client = { Network: {} } as CdpNetworkClient;
    const logger = createLogger();
    const networkHeaderClient = new NetworkHeaderClient(client, logger as never);
    // Action
    await networkHeaderClient.applyExtraHeaders({ DNT: '1' });
    // Assert
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('whenApplyingHeadersFails_applyExtraHeaders_shouldLogWarning', async () => {
    // Arrange
    const setExtraHTTPHeaders = jest.fn<(params: { headers: Record<string, string> }) => Promise<void>>()
      .mockRejectedValue(new Error('fail'));
    const client = { Network: { setExtraHTTPHeaders } } as CdpNetworkClient;
    const logger = createLogger();
    const networkHeaderClient = new NetworkHeaderClient(client, logger as never);
    // Action
    await networkHeaderClient.applyExtraHeaders({ DNT: '1' });
    // Assert
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to set extra headers.'));
  });
});
