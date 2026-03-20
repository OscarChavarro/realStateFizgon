import { describe, expect, it, jest } from '@jest/globals';
import { CdpNetworkClient } from 'application/services/chromium/cdp-network-client.type';
import { UserAgentOverrideClient } from 'application/services/chromium/user-agent-override-client';
import { UserAgentOverridePayload } from 'application/services/chromium/user-agent-override-payload.type';

type LoggerMock = {
  warn: jest.Mock<(message: string) => void>;
};

function createLogger(): LoggerMock {
  return {
    warn: jest.fn<(message: string) => void>()
  };
}

function createOverridePayload(): UserAgentOverridePayload {
  return {
    userAgent: 'Mozilla/5.0 Chrome/145.0.0.0',
    acceptLanguage: 'en-US,en',
    platform: 'Linux x86_64'
  };
}

describe('UserAgentOverrideClient', () => {
  it('whenOverrideIsUndefined_apply_shouldDoNothing', async () => {
    // Arrange
    const emulationSetter = jest.fn<(params: UserAgentOverridePayload) => Promise<void>>();
    const client = { Emulation: { setUserAgentOverride: emulationSetter } } as CdpNetworkClient;
    const logger = createLogger();
    const overrideClient = new UserAgentOverrideClient(client, logger as never);
    // Action
    await overrideClient.apply(undefined);
    // Assert
    expect(emulationSetter).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('whenEmulationOverrideExists_apply_shouldUseEmulationDomain', async () => {
    // Arrange
    const payload = createOverridePayload();
    const emulationSetter = jest.fn<(params: UserAgentOverridePayload) => Promise<void>>().mockResolvedValue(undefined);
    const networkSetter = jest.fn<(params: UserAgentOverridePayload) => Promise<void>>().mockResolvedValue(undefined);
    const client = {
      Emulation: { setUserAgentOverride: emulationSetter },
      Network: { setUserAgentOverride: networkSetter }
    } as CdpNetworkClient;
    const logger = createLogger();
    const overrideClient = new UserAgentOverrideClient(client, logger as never);
    // Action
    await overrideClient.apply(payload);
    // Assert
    expect(emulationSetter).toHaveBeenCalledWith(payload);
    expect(networkSetter).not.toHaveBeenCalled();
  });

  it('whenEmulationIsMissing_apply_shouldFallbackToNetworkDomain', async () => {
    // Arrange
    const payload = createOverridePayload();
    const networkSetter = jest.fn<(params: UserAgentOverridePayload) => Promise<void>>().mockResolvedValue(undefined);
    const client = { Network: { setUserAgentOverride: networkSetter } } as CdpNetworkClient;
    const logger = createLogger();
    const overrideClient = new UserAgentOverrideClient(client, logger as never);
    // Action
    await overrideClient.apply(payload);
    // Assert
    expect(networkSetter).toHaveBeenCalledWith(payload);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('whenNoOverrideMethodExists_apply_shouldLogWarning', async () => {
    // Arrange
    const payload = createOverridePayload();
    const client = { Emulation: {}, Network: {} } as CdpNetworkClient;
    const logger = createLogger();
    const overrideClient = new UserAgentOverrideClient(client, logger as never);
    // Action
    await overrideClient.apply(payload);
    // Assert
    expect(logger.warn).toHaveBeenCalledWith(
      'Neither Emulation.setUserAgentOverride nor Network.setUserAgentOverride is available.'
    );
  });

  it('whenOverrideThrows_apply_shouldLogWarning', async () => {
    // Arrange
    const payload = createOverridePayload();
    const emulationSetter = jest.fn<(params: UserAgentOverridePayload) => Promise<void>>().mockRejectedValue(new Error('boom'));
    const client = { Emulation: { setUserAgentOverride: emulationSetter } } as CdpNetworkClient;
    const logger = createLogger();
    const overrideClient = new UserAgentOverrideClient(client, logger as never);
    // Action
    await overrideClient.apply(payload);
    // Assert
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to override user agent metadata.'));
  });
});
