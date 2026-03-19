import { describe, expect, it, jest } from '@jest/globals';
import { ScheduleService } from 'src/application/services/state/schedule.service';
import { PromoteIdleToScheduledScrapeUseCase } from 'src/application/usecases/promote-idle-to-scheduled-scrape.use-case';

class PromoteIdleToScheduledScrapeUseCaseMockForScheduleService {
  readonly execute = jest.fn<(nowMs?: number) => boolean>();
}

function createService() {
  const promoteIdleToScheduledScrapeUseCase = new PromoteIdleToScheduledScrapeUseCaseMockForScheduleService();
  const scheduleService = new ScheduleService(
    promoteIdleToScheduledScrapeUseCase as unknown as PromoteIdleToScheduledScrapeUseCase
  );

  return { scheduleService, promoteIdleToScheduledScrapeUseCase };
}

describe('ScheduleService', () => {
  it('whenNowIsProvided_promoteIdleToScheduledScrapeIfDue_shouldDelegateToUseCaseWithProvidedNow', () => {
    // Arrange
    const { scheduleService, promoteIdleToScheduledScrapeUseCase } = createService();
    promoteIdleToScheduledScrapeUseCase.execute.mockReturnValue(true);
    // Action
    const promoted = scheduleService.promoteIdleToScheduledScrapeIfDue(1234);
    // Assert
    expect(promoted).toBe(true);
    expect(promoteIdleToScheduledScrapeUseCase.execute).toHaveBeenCalledTimes(1);
    expect(promoteIdleToScheduledScrapeUseCase.execute).toHaveBeenCalledWith(1234);
  });

  it('whenNowIsOmitted_promoteIdleToScheduledScrapeIfDue_shouldDelegateToUseCaseWithUndefinedNow', () => {
    // Arrange
    const { scheduleService, promoteIdleToScheduledScrapeUseCase } = createService();
    promoteIdleToScheduledScrapeUseCase.execute.mockReturnValue(false);
    // Action
    const promoted = scheduleService.promoteIdleToScheduledScrapeIfDue();
    // Assert
    expect(promoted).toBe(false);
    expect(promoteIdleToScheduledScrapeUseCase.execute).toHaveBeenCalledTimes(1);
    expect(promoteIdleToScheduledScrapeUseCase.execute).toHaveBeenCalledWith(undefined);
  });
});
