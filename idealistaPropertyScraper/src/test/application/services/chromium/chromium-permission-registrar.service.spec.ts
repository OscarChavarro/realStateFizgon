import { describe, expect, it, jest } from '@jest/globals';
import { ChromiumPermissionRegistrarService } from 'src/application/services/chromium/chromium-permission-registrar.service';

type CdpClient = {
  Browser?: {
    grantPermissions?: (params: { origin: string; permissions: string[] }) => Promise<void>;
  };
};

type CdpPage = {
  frameNavigated: (callback: (event: { frame?: { url?: string } }) => void) => void;
};

function createService() {
  const service = new ChromiumPermissionRegistrarService();
  const logger = {
    warn: jest.fn<(message: string) => void>(),
    log: jest.fn<(message: string) => void>(),
    error: jest.fn<(message: string) => void>()
  };
  (service as unknown as { logger: typeof logger }).logger = logger;
  return { service, logger };
}

describe('ChromiumPermissionRegistrarService', () => {
  it('whenPageNavigates_registerPageNavigationListener_shouldAuthorizeNavigatedOrigin', async () => {
    // Arrange
    const { service } = createService();
    let frameNavigatedCallback: ((event: { frame?: { url?: string } }) => void) | undefined;
    const page: CdpPage = {
      frameNavigated: (callback) => {
        frameNavigatedCallback = callback;
      }
    };
    const ensureOriginIsAuthorizedSpy = jest.spyOn(
      service as unknown as {
        ensureOriginIsAuthorized: (client: CdpClient, urlOrOrigin: string, allowlist?: string[]) => Promise<void>;
      },
      'ensureOriginIsAuthorized'
    ).mockResolvedValue(undefined);
    const client: CdpClient = {};
    // Action
    service.registerPageNavigationListener(client, page, ['https://www.idealista.com']);
    frameNavigatedCallback?.({ frame: { url: 'https://www.idealista.com/inmueble/1/' } });
    await Promise.resolve();
    // Assert
    expect(ensureOriginIsAuthorizedSpy).toHaveBeenCalledWith(
      client,
      'https://www.idealista.com/inmueble/1/',
      ['https://www.idealista.com']
    );
  });

  it('whenEventHasNoFrameUrl_registerPageNavigationListener_shouldFallbackToEmptyUrl', async () => {
    // Arrange
    const { service } = createService();
    let frameNavigatedCallback: ((event: { frame?: { url?: string } }) => void) | undefined;
    const page: CdpPage = {
      frameNavigated: (callback) => {
        frameNavigatedCallback = callback;
      }
    };
    const ensureOriginIsAuthorizedSpy = jest.spyOn(
      service as unknown as {
        ensureOriginIsAuthorized: (client: CdpClient, urlOrOrigin: string, allowlist?: string[]) => Promise<void>;
      },
      'ensureOriginIsAuthorized'
    ).mockResolvedValue(undefined);
    const client: CdpClient = {};
    // Action
    service.registerPageNavigationListener(client, page);
    frameNavigatedCallback?.({});
    await Promise.resolve();
    // Assert
    expect(ensureOriginIsAuthorizedSpy).toHaveBeenCalledWith(client, '', undefined);
  });

  it('whenOriginIsInvalid_ensureOriginIsAuthorized_shouldSkipPermissionGrant', async () => {
    // Arrange
    const { service } = createService();
    const grantSpy = jest.spyOn(
      service as unknown as {
        grantGeolocationPermission: (client: CdpClient, origin: string) => Promise<void>;
      },
      'grantGeolocationPermission'
    );
    // Action
    await service.ensureOriginIsAuthorized({}, 'not-an-url');
    // Assert
    expect(grantSpy).not.toHaveBeenCalled();
  });

  it('whenOriginInputIsUndefined_ensureOriginIsAuthorized_shouldHandleNullishOriginSafely', async () => {
    // Arrange
    const { service } = createService();
    const grantSpy = jest.spyOn(
      service as unknown as {
        grantGeolocationPermission: (client: CdpClient, origin: string) => Promise<void>;
      },
      'grantGeolocationPermission'
    );
    // Action
    await service.ensureOriginIsAuthorized({}, undefined as unknown as string);
    // Assert
    expect(grantSpy).not.toHaveBeenCalled();
  });

  it('whenOriginIsNotInAllowlist_ensureOriginIsAuthorized_shouldSkipPermissionGrant', async () => {
    // Arrange
    const { service } = createService();
    const grantSpy = jest.spyOn(
      service as unknown as {
        grantGeolocationPermission: (client: CdpClient, origin: string) => Promise<void>;
      },
      'grantGeolocationPermission'
    );
    // Action
    await service.ensureOriginIsAuthorized({}, 'https://www.idealista.com/inmueble/1/', ['https://www.otro.com']);
    // Assert
    expect(grantSpy).not.toHaveBeenCalled();
  });

  it('whenOriginIsAllowed_ensureOriginIsAuthorized_shouldGrantPermission', async () => {
    // Arrange
    const { service } = createService();
    const grantPermissions = jest.fn<(
      params: { origin: string; permissions: string[] }
    ) => Promise<void>>(async () => undefined);
    // Action
    await service.ensureOriginIsAuthorized(
      { Browser: { grantPermissions } },
      'https://www.idealista.com/inmueble/1/',
      ['https://www.idealista.com']
    );
    // Assert
    expect(grantPermissions).toHaveBeenCalledWith({
      origin: 'https://www.idealista.com',
      permissions: ['geolocation']
    });
  });

  it('whenAllowlistIsEmpty_grantGeolocationPermissions_shouldDoNothing', async () => {
    // Arrange
    const { service } = createService();
    const grantPermissions = jest.fn<(
      params: { origin: string; permissions: string[] }
    ) => Promise<void>>(async () => undefined);
    // Action
    await service.grantGeolocationPermissions({ Browser: { grantPermissions } }, []);
    // Assert
    expect(grantPermissions).not.toHaveBeenCalled();
  });

  it('whenAllowlistContainsInvalidAndValidEntries_grantGeolocationPermissions_shouldGrantOnlyValidOrigins', async () => {
    // Arrange
    const { service } = createService();
    const grantPermissions = jest.fn<(
      params: { origin: string; permissions: string[] }
    ) => Promise<void>>(async () => undefined);
    // Action
    await service.grantGeolocationPermissions(
      { Browser: { grantPermissions } },
      ['mailto:user@example.com', 'https://www.idealista.com/path', 'https://www.idealista.com/path-2']
    );
    // Assert
    expect(grantPermissions).toHaveBeenCalledTimes(1);
    expect(grantPermissions).toHaveBeenCalledWith({
      origin: 'https://www.idealista.com',
      permissions: ['geolocation']
    });
  });

  it('whenGrantPermissionsApiIsMissing_ensureOriginIsAuthorized_shouldWarnAndSkip', async () => {
    // Arrange
    const { service, logger } = createService();
    // Action
    await service.ensureOriginIsAuthorized({}, 'https://www.idealista.com/inmueble/1/');
    // Assert
    expect(logger.warn).toHaveBeenCalledWith(
      'CDP Browser.grantPermissions not available. Skipping permission grant.'
    );
  });

  it('whenGrantPermissionsFails_ensureOriginIsAuthorized_shouldWarnAndCleanupPendingOrigin', async () => {
    // Arrange
    const { service, logger } = createService();
    const grantPermissions = jest.fn<(
      params: { origin: string; permissions: string[] }
    ) => Promise<void>>(async () => {
      throw new Error('boom');
    });
    // Action
    await service.ensureOriginIsAuthorized(
      { Browser: { grantPermissions } },
      'https://www.idealista.com/inmueble/1/'
    );
    // Assert
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to grant geolocation permissions for https://www.idealista.com. boom'
    );
    expect(
      (service as unknown as { pendingOrigins: Set<string> }).pendingOrigins.has('https://www.idealista.com')
    ).toBe(false);
  });

  it('whenOriginWasAlreadyAuthorized_ensureOriginIsAuthorized_shouldSkipSecondGrantCall', async () => {
    // Arrange
    const { service } = createService();
    const grantPermissions = jest.fn<(
      params: { origin: string; permissions: string[] }
    ) => Promise<void>>(async () => undefined);
    const client = { Browser: { grantPermissions } };
    // Action
    await service.ensureOriginIsAuthorized(client, 'https://www.idealista.com/inmueble/1/');
    await service.ensureOriginIsAuthorized(client, 'https://www.idealista.com/inmueble/2/');
    // Assert
    expect(grantPermissions).toHaveBeenCalledTimes(1);
  });
});
