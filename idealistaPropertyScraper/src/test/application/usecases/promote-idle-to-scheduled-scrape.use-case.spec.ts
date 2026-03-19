import { describe, expect, it, jest } from '@jest/globals';
import { ScraperStateMachineService } from 'src/application/services/state/scraper-state-machine.service';
import { PromoteIdleToScheduledScrapeUseCase } from 'src/application/usecases/promote-idle-to-scheduled-scrape.use-case';
import { ScraperState } from 'src/domain/states/scraper-state.enum';
import { ScraperConfig } from 'src/infrastructure/config/settings/scraper.config';
import { ScraperConfigMock } from '../../support/mocks/scraper-config.mock';

function createUseCase(params?: {
  initialState?: ScraperState;
  reScrapeIntervalMs?: number;
}): {
  useCase: PromoteIdleToScheduledScrapeUseCase;
  stateMachineService: ScraperStateMachineService;
} {
  const config = new ScraperConfigMock({
    initialScraperState: params?.initialState ?? ScraperState.IDLE,
    reScrapeIntervalMs: params?.reScrapeIntervalMs ?? 900000
  });
  const stateMachineService = new ScraperStateMachineService(config as unknown as ScraperConfig);
  const useCase = new PromoteIdleToScheduledScrapeUseCase(
    stateMachineService,
    config as unknown as ScraperConfig
  );
  return { useCase, stateMachineService };
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
    const { useCase, stateMachineService } = createUseCase({
      initialState: ScraperState.IDLE,
      reScrapeIntervalMs: 1000
    });
    const lastIdleAt = stateMachineService.getLastIdleReachedAtMs() ?? 0;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(lastIdleAt + 1000);
    // Action
    const promoted = useCase.execute();
    // Assert
    expect(promoted).toBe(true);
    expect(stateMachineService.getCurrentState()).toBe(ScraperState.SCRAPING_FOR_NEW_PROPERTIES);
    nowSpy.mockRestore();
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
