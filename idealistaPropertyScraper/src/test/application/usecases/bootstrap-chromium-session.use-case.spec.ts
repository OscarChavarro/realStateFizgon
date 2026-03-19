import { describe, expect, it, jest } from '@jest/globals';
import { ChromiumCdpReadinessService } from 'src/application/services/chromium/chromium-cdp-readiness.service';
import { ChromiumGeolocationService } from 'src/application/services/chromium/chromium-geolocation.service';
import { ChromiumNetworkHeadersService } from 'src/application/services/chromium/chromium-network-headers.service';
import { ChromiumProcessLifecycleService } from 'src/application/services/chromium/chromium-process-lifecycle.service';
import { BootstrapChromiumSessionUseCase } from 'src/application/usecases/bootstrap-chromium-session.use-case';

class ChromiumProcessLifecycleServiceMockForBootstrapChromiumSessionUseCase {
  readonly launchChromiumProcess = jest.fn<
    (
      cdpPort: number,
      onUnexpectedExit: (code: number | null, signal: NodeJS.Signals | null) => void,
      isShuttingDown: () => boolean
    ) => Promise<void>
  >();
}

class ChromiumCdpReadinessServiceMockForBootstrapChromiumSessionUseCase {
  readonly waitForReadyEndpoint = jest.fn<(host: string, port: number) => Promise<void>>();
}

class ChromiumGeolocationServiceMockForBootstrapChromiumSessionUseCase {
  readonly grantStartupPermissions = jest.fn<(host: string, port: number) => Promise<void>>();
  readonly startTargetLoop = jest.fn<(host: string, port: number, isShuttingDown: () => boolean) => void>();
}

class ChromiumNetworkHeadersServiceMockForBootstrapChromiumSessionUseCase {
  readonly startTargetLoop = jest.fn<(host: string, port: number, isShuttingDown: () => boolean) => void>();
}

function createUseCase() {
  const chromiumProcessLifecycleService = new ChromiumProcessLifecycleServiceMockForBootstrapChromiumSessionUseCase();
  chromiumProcessLifecycleService.launchChromiumProcess.mockResolvedValue(undefined);
  const chromiumCdpReadinessService = new ChromiumCdpReadinessServiceMockForBootstrapChromiumSessionUseCase();
  chromiumCdpReadinessService.waitForReadyEndpoint.mockResolvedValue(undefined);
  const chromiumGeolocationService = new ChromiumGeolocationServiceMockForBootstrapChromiumSessionUseCase();
  chromiumGeolocationService.grantStartupPermissions.mockResolvedValue(undefined);
  const chromiumNetworkHeadersService = new ChromiumNetworkHeadersServiceMockForBootstrapChromiumSessionUseCase();
  const useCase = new BootstrapChromiumSessionUseCase(
    chromiumProcessLifecycleService as unknown as ChromiumProcessLifecycleService,
    chromiumCdpReadinessService as unknown as ChromiumCdpReadinessService,
    chromiumGeolocationService as unknown as ChromiumGeolocationService,
    chromiumNetworkHeadersService as unknown as ChromiumNetworkHeadersService
  );
  return {
    useCase,
    chromiumProcessLifecycleService,
    chromiumCdpReadinessService,
    chromiumGeolocationService,
    chromiumNetworkHeadersService
  };
}

describe('BootstrapChromiumSessionUseCase', () => {
  it('whenChromiumBootstraps_execute_shouldLaunchAndInitializeStartupHardening', async () => {
    // Arrange
    const {
      useCase,
      chromiumProcessLifecycleService,
      chromiumCdpReadinessService,
      chromiumGeolocationService,
      chromiumNetworkHeadersService
    } = createUseCase();
    const onUnexpectedExit = jest.fn<(code: number | null, signal: NodeJS.Signals | null) => void>();
    const isShuttingDown = (): boolean => false;
    // Action
    await useCase.execute({
      cdpHost: '127.0.0.1',
      cdpPort: 9222,
      onUnexpectedExit,
      isShuttingDown
    });
    // Assert
    expect(chromiumProcessLifecycleService.launchChromiumProcess).toHaveBeenCalledWith(9222, onUnexpectedExit, isShuttingDown);
    expect(chromiumCdpReadinessService.waitForReadyEndpoint).toHaveBeenCalledWith('127.0.0.1', 9222);
    expect(chromiumGeolocationService.grantStartupPermissions).toHaveBeenCalledWith('127.0.0.1', 9222);
    expect(chromiumGeolocationService.startTargetLoop).toHaveBeenCalledWith('127.0.0.1', 9222, isShuttingDown);
    expect(chromiumNetworkHeadersService.startTargetLoop).toHaveBeenCalledWith('127.0.0.1', 9222, isShuttingDown);
  });

  it('whenChromiumBootstraps_execute_shouldWaitForReadinessBeforeStartingLoops', async () => {
    // Arrange
    const {
      useCase,
      chromiumProcessLifecycleService,
      chromiumCdpReadinessService,
      chromiumGeolocationService,
      chromiumNetworkHeadersService
    } = createUseCase();
    const onUnexpectedExit = jest.fn<(code: number | null, signal: NodeJS.Signals | null) => void>();
    const isShuttingDown = (): boolean => false;
    // Action
    await useCase.execute({
      cdpHost: '127.0.0.1',
      cdpPort: 9333,
      onUnexpectedExit,
      isShuttingDown
    });
    // Assert
    const launchOrder = chromiumProcessLifecycleService.launchChromiumProcess.mock.invocationCallOrder[0];
    const readyOrder = chromiumCdpReadinessService.waitForReadyEndpoint.mock.invocationCallOrder[0];
    const grantOrder = chromiumGeolocationService.grantStartupPermissions.mock.invocationCallOrder[0];
    const geoLoopOrder = chromiumGeolocationService.startTargetLoop.mock.invocationCallOrder[0];
    const headerLoopOrder = chromiumNetworkHeadersService.startTargetLoop.mock.invocationCallOrder[0];
    expect(launchOrder).toBeLessThan(readyOrder);
    expect(readyOrder).toBeLessThan(grantOrder);
    expect(grantOrder).toBeLessThan(geoLoopOrder);
    expect(grantOrder).toBeLessThan(headerLoopOrder);
  });
});
