import { describe, expect, it, jest } from '@jest/globals';
import { ScraperStateMachineService } from 'application/services/state/scraper-state-machine.service';
import { PromoteIdleToScheduledScrapeUseCase } from 'application/usecases/state/promote-idle-to-scheduled-scrape.use-case';
import { ScraperState } from 'domain/states/scraper-state';
import { ScraperConfig } from 'infrastructure/config/settings/scraper.config';
import { ScraperConfigMock } from '../../../support/mocks/scraper-config.mock';

function createUseCase(params?: {
  initialState?: ScraperState;
  reScrapeIntervalMs?: number;
}): {
  useCase: PromoteIdleToScheduledScrapeUseCase;
  stateMachineService: ScraperStateMachineService;
  clockPort: { nowMs: jest.MockedFunction<() => number> };
} {
  const config = new ScraperConfigMock({
    initialScraperState: params?.initialState ?? ScraperState.IDLE,
    reScrapeIntervalMs: params?.reScrapeIntervalMs ?? 900000
  });
  const clockPort = { nowMs: jest.fn<() => number>().mockReturnValue(0) };
  const stateMachineService = new ScraperStateMachineService(
    config as unknown as ScraperConfig,
    clockPort as never
  );
  const useCase = new PromoteIdleToScheduledScrapeUseCase(
    stateMachineService,
    config as unknown as ScraperConfig,
    clockPort as never
  );
  return { useCase, stateMachineService, clockPort };
}

describe('PromoteIdleToScheduledScrapeUseCase', () => {
  it('whenStateIsNotIdle_execute_shouldKeepCurrentStateWithoutChanges', () => {
    // Arrange
    const { useCase, stateMachineService } = createUseCase({
      initialState: ScraperState.UPDATING_PROPERTIES,
      reScrapeIntervalMs: 1000
    });
    // Action
    const promoted = useCase.execute(2000);
    // Assert
    expect(promoted).toBe(false);
    expect(stateMachineService.getCurrentState()).toBe(ScraperState.UPDATING_PROPERTIES);
  });

  it('whenIdleIntervalIsNotReached_execute_shouldRemainIdle', () => {
    // Arrange
    const { useCase, stateMachineService } = createUseCase({
      initialState: ScraperState.IDLE,
      reScrapeIntervalMs: 1000
    });
    const lastIdleAt = stateMachineService.getLastIdleReachedAtMs() ?? 0;
    // Action
    const promoted = useCase.execute(lastIdleAt + 999);
    // Assert
    expect(promoted).toBe(false);
    expect(stateMachineService.getCurrentState()).toBe(ScraperState.IDLE);
  });

  it('whenIdleIntervalIsReached_execute_shouldSwitchToScrapingForNewProperties', () => {
    // Arrange
    const { useCase, stateMachineService } = createUseCase({
      initialState: ScraperState.IDLE,
      reScrapeIntervalMs: 1000
    });
    const lastIdleAt = stateMachineService.getLastIdleReachedAtMs() ?? 0;
    // Action
    const promoted = useCase.execute(lastIdleAt + 1000);
    // Assert
    expect(promoted).toBe(true);
    expect(stateMachineService.getCurrentState()).toBe(ScraperState.SCRAPING_FOR_NEW_PROPERTIES);
  });

  it('whenNowParameterIsOmitted_execute_shouldUseDateNowDefaultValue', () => {
    // Arrange
    const { useCase, stateMachineService, clockPort } = createUseCase({
      initialState: ScraperState.IDLE,
      reScrapeIntervalMs: 1000
    });
    const lastIdleAt = stateMachineService.getLastIdleReachedAtMs() ?? 0;
    clockPort.nowMs.mockReturnValue(lastIdleAt + 1000);
    // Action
    const promoted = useCase.execute();
    // Assert
    expect(promoted).toBe(true);
    expect(stateMachineService.getCurrentState()).toBe(ScraperState.SCRAPING_FOR_NEW_PROPERTIES);
  });

  it('whenIdleTimestampIsUnavailable_execute_shouldSkipPromotion', () => {
    // Arrange
    const { useCase, stateMachineService } = createUseCase({
      initialState: ScraperState.IDLE,
      reScrapeIntervalMs: 1000
    });
    (stateMachineService as unknown as { lastIdleReachedAtMs: number | null }).lastIdleReachedAtMs = null;
    // Action
    const promoted = useCase.execute(5000);
    // Assert
    expect(promoted).toBe(false);
    expect(stateMachineService.getCurrentState()).toBe(ScraperState.IDLE);
  });
});
