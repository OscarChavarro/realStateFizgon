import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { ScraperStateMachineService } from 'src/application/services/state/scraper-state-machine.service';
import { ScraperConfig } from 'src/infrastructure/config/settings/scraper.config';
import { ScraperState } from 'src/domain/states/scraper-state.enum';
import { ScraperConfigMock } from '../../../support/mocks/scraper-config.mock';

describe('ScraperStateMachineService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('whenServiceIsCreated_getCurrentState_shouldReturnInitialStateFromConfig', () => {
    // Arrange
    const config = new ScraperConfigMock({ initialScraperState: ScraperState.UPDATING_PROPERTIES });
    const service = new ScraperStateMachineService(config as unknown as ScraperConfig);
    // Action
    const result = service.getCurrentState();
    // Assert
    expect(result).toBe(ScraperState.UPDATING_PROPERTIES);
  });

  it('whenServiceStartsInIdle_getLastIdleReachedAtMs_shouldCaptureCreationTime', () => {
    // Arrange
    jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
    const config = new ScraperConfigMock({ initialScraperState: ScraperState.IDLE });
    const service = new ScraperStateMachineService(config as unknown as ScraperConfig);
    // Action
    const lastIdleReachedAtMs = service.getLastIdleReachedAtMs();
    // Assert
    expect(lastIdleReachedAtMs).toBe(1700000000000);
  });

  it('whenServiceStartsInNonIdle_getLastIdleReachedAtMs_shouldBeNullUntilIdleIsReached', () => {
    // Arrange
    const config = new ScraperConfigMock({ initialScraperState: ScraperState.UPDATING_PROPERTIES });
    const service = new ScraperStateMachineService(config as unknown as ScraperConfig);
    // Action
    const lastIdleReachedAtMs = service.getLastIdleReachedAtMs();
    // Assert
    expect(lastIdleReachedAtMs).toBeNull();
  });

  it('whenSameStateIsRequestedAgain_enqueueStateRequest_shouldCoalesceWithoutDuplicatingQueue', () => {
    // Arrange
    const config = new ScraperConfigMock();
    const service = new ScraperStateMachineService(config as unknown as ScraperConfig);
    service.enqueueUpdatePropertiesRequest();
    service.enqueueScrapePropertiesRequest();
    // Action
    const pending = service.enqueueUpdatePropertiesRequest();
    // Assert
    expect(pending).toBe(2);
    expect(service.consumeNextRequestedState()).toBe(ScraperState.SCRAPING_FOR_NEW_PROPERTIES);
    expect(service.consumeNextRequestedState()).toBe(ScraperState.UPDATING_PROPERTIES);
  });

  it('whenRequestedStateIsAlreadyLatest_enqueueStateRequest_shouldKeepQueueOrder', () => {
    // Arrange
    const config = new ScraperConfigMock();
    const service = new ScraperStateMachineService(config as unknown as ScraperConfig);
    service.enqueueUpdatePropertiesRequest();
    // Action
    const pending = service.enqueueUpdatePropertiesRequest();
    // Assert
    expect(pending).toBe(1);
    expect(service.consumeNextRequestedState()).toBe(ScraperState.UPDATING_PROPERTIES);
  });

  it('whenQueueExceedsLimit_enqueueStateRequest_shouldDropOldestPendingState', () => {
    // Arrange
    const config = new ScraperConfigMock();
    const service = new ScraperStateMachineService(config as unknown as ScraperConfig);
    const enqueue = (service as unknown as { enqueueStateRequest: (state: ScraperState) => number }).enqueueStateRequest;
    for (let index = 0; index < 12; index += 1) {
      enqueue.call(service, `STATE_${index}` as unknown as ScraperState);
    }
    // Action
    const firstConsumed = service.consumeNextRequestedState();
    // Assert
    expect(service.getPendingRequestsCount()).toBe(9);
    expect(firstConsumed).toBe('STATE_2');
  });

  it('whenDroppedStateIsUndefined_enqueueStateRequest_shouldStillKeepQueueWithinLimit', () => {
    // Arrange
    const config = new ScraperConfigMock();
    const service = new ScraperStateMachineService(config as unknown as ScraperConfig);
    const queue = (service as unknown as { requestedStateQueue: Array<ScraperState> }).requestedStateQueue;
    queue.push(undefined as unknown as ScraperState);
    for (let index = 1; index < 10; index += 1) {
      queue.push(`STATE_${index}` as unknown as ScraperState);
    }
    // Action
    const pending = (service as unknown as { enqueueStateRequest: (state: ScraperState) => number })
      .enqueueStateRequest(ScraperState.UPDATING_PROPERTIES);
    // Assert
    expect(pending).toBe(10);
    expect(service.getPendingRequestsCount()).toBe(10);
  });

  it.each([
    {
      operation: (service: ScraperStateMachineService) => service.finishScrapingForNewPropertiesCycle()
    },
    {
      operation: (service: ScraperStateMachineService) => service.finishUpdatingPropertiesCycle()
    }
  ])('whenPendingStateExists_finishCycle_shouldTransitionToNextRequestedState', ({ operation }) => {
    // Arrange
    const config = new ScraperConfigMock();
    const service = new ScraperStateMachineService(config as unknown as ScraperConfig);
    service.enqueueUpdatePropertiesRequest();
    // Action
    const result = operation(service);
    // Assert
    expect(result).toBe(ScraperState.UPDATING_PROPERTIES);
    expect(service.getPendingRequestsCount()).toBe(0);
  });

  it('whenNoPendingStateExists_finishScrapingForNewPropertiesCycle_shouldReturnIdle', () => {
    // Arrange
    const config = new ScraperConfigMock();
    const service = new ScraperStateMachineService(config as unknown as ScraperConfig);
    // Action
    const result = service.finishScrapingForNewPropertiesCycle();
    // Assert
    expect(result).toBe(ScraperState.IDLE);
    expect(service.getPendingRequestsCount()).toBe(0);
  });

  it('whenNoPendingStateExists_finishUpdatingPropertiesCycle_shouldReturnIdle', () => {
    // Arrange
    const config = new ScraperConfigMock();
    const service = new ScraperStateMachineService(config as unknown as ScraperConfig);
    // Action
    const result = service.finishUpdatingPropertiesCycle();
    // Assert
    expect(result).toBe(ScraperState.IDLE);
    expect(service.getPendingRequestsCount()).toBe(0);
  });

  it('whenStateIsSet_setState_shouldReplaceCurrentState', () => {
    // Arrange
    const config = new ScraperConfigMock();
    const service = new ScraperStateMachineService(config as unknown as ScraperConfig);
    // Action
    service.setState(ScraperState.SCRAPING_FOR_NEW_PROPERTIES);
    // Assert
    expect(service.getCurrentState()).toBe(ScraperState.SCRAPING_FOR_NEW_PROPERTIES);
  });

  it('whenStateTransitionsToIdle_setState_shouldUpdateLastIdleTimestamp', () => {
    // Arrange
    const config = new ScraperConfigMock({ initialScraperState: ScraperState.UPDATING_PROPERTIES });
    const service = new ScraperStateMachineService(config as unknown as ScraperConfig);
    jest.spyOn(Date, 'now').mockReturnValue(1700000005555);
    // Action
    service.setState(ScraperState.IDLE);
    // Assert
    expect(service.getLastIdleReachedAtMs()).toBe(1700000005555);
  });

  it('whenScrapeCycleFinishes_finishScrapingForNewPropertiesCycle_shouldUpdateLastIdleTimestamp', () => {
    // Arrange
    const config = new ScraperConfigMock({ initialScraperState: ScraperState.SCRAPING_FOR_NEW_PROPERTIES });
    const service = new ScraperStateMachineService(config as unknown as ScraperConfig);
    jest.spyOn(Date, 'now').mockReturnValue(1700000007777);
    // Action
    service.finishScrapingForNewPropertiesCycle();
    // Assert
    expect(service.getLastIdleReachedAtMs()).toBe(1700000007777);
  });
});
