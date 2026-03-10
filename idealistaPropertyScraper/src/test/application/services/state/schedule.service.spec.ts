import { describe, expect, it } from '@jest/globals';
import { jest } from '@jest/globals';
import { ScheduleService } from 'src/application/services/state/schedule.service';
import { ScraperStateMachineService } from 'src/application/services/state/scraper-state-machine.service';
import { ScraperState } from 'src/domain/states/scraper-state.enum';
import { ScraperConfig } from 'src/infrastructure/config/settings/scraper.config';
import { ScraperConfigMock } from '../../../support/mocks/scraper-config.mock';

function createService(params?: {
  initialState?: ScraperState;
  reScrapeIntervalMs?: number;
}): {
  scheduleService: ScheduleService;
  stateMachineService: ScraperStateMachineService;
} {
  const config = new ScraperConfigMock({
    initialScraperState: params?.initialState ?? ScraperState.IDLE,
    reScrapeIntervalMs: params?.reScrapeIntervalMs ?? 900000
  });
  const stateMachineService = new ScraperStateMachineService(config as unknown as ScraperConfig);
  const scheduleService = new ScheduleService(
    stateMachineService,
    config as unknown as ScraperConfig
  );
  return { scheduleService, stateMachineService };
}

describe('ScheduleService', () => {
  it('whenStateIsNotIdle_promoteIdleToScheduledScrapeIfDue_shouldKeepCurrentStateWithoutChanges', () => {
    // Arrange
    const { scheduleService, stateMachineService } = createService({
      initialState: ScraperState.UPDATING_PROPERTIES,
      reScrapeIntervalMs: 1000
    });
    // Action
    const promoted = scheduleService.promoteIdleToScheduledScrapeIfDue(2000);
    // Assert
    expect(promoted).toBe(false);
    expect(stateMachineService.getCurrentState()).toBe(ScraperState.UPDATING_PROPERTIES);
  });

  it('whenIdleIntervalIsNotReached_promoteIdleToScheduledScrapeIfDue_shouldRemainIdle', () => {
    // Arrange
    const { scheduleService, stateMachineService } = createService({
      initialState: ScraperState.IDLE,
      reScrapeIntervalMs: 1000
    });
    const lastIdleAt = stateMachineService.getLastIdleReachedAtMs() ?? 0;
    // Action
    const promoted = scheduleService.promoteIdleToScheduledScrapeIfDue(lastIdleAt + 999);
    // Assert
    expect(promoted).toBe(false);
    expect(stateMachineService.getCurrentState()).toBe(ScraperState.IDLE);
  });

  it('whenIdleIntervalIsReached_promoteIdleToScheduledScrapeIfDue_shouldSwitchToScrapingForNewProperties', () => {
    // Arrange
    const { scheduleService, stateMachineService } = createService({
      initialState: ScraperState.IDLE,
      reScrapeIntervalMs: 1000
    });
    const lastIdleAt = stateMachineService.getLastIdleReachedAtMs() ?? 0;
    // Action
    const promoted = scheduleService.promoteIdleToScheduledScrapeIfDue(lastIdleAt + 1000);
    // Assert
    expect(promoted).toBe(true);
    expect(stateMachineService.getCurrentState()).toBe(ScraperState.SCRAPING_FOR_NEW_PROPERTIES);
  });

  it('whenNowParameterIsOmitted_promoteIdleToScheduledScrapeIfDue_shouldUseDateNowDefaultValue', () => {
    // Arrange
    const { scheduleService, stateMachineService } = createService({
      initialState: ScraperState.IDLE,
      reScrapeIntervalMs: 1000
    });
    const lastIdleAt = stateMachineService.getLastIdleReachedAtMs() ?? 0;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(lastIdleAt + 1000);
    // Action
    const promoted = scheduleService.promoteIdleToScheduledScrapeIfDue();
    // Assert
    expect(promoted).toBe(true);
    expect(stateMachineService.getCurrentState()).toBe(ScraperState.SCRAPING_FOR_NEW_PROPERTIES);
    nowSpy.mockRestore();
  });

  it('whenIdleTimestampIsUnavailable_promoteIdleToScheduledScrapeIfDue_shouldSkipPromotion', () => {
    // Arrange
    const { scheduleService, stateMachineService } = createService({
      initialState: ScraperState.IDLE,
      reScrapeIntervalMs: 1000
    });
    (stateMachineService as unknown as { lastIdleReachedAtMs: number | null }).lastIdleReachedAtMs = null;
    // Action
    const promoted = scheduleService.promoteIdleToScheduledScrapeIfDue(5000);
    // Assert
    expect(promoted).toBe(false);
    expect(stateMachineService.getCurrentState()).toBe(ScraperState.IDLE);
  });
});
