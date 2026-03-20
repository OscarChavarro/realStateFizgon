import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PropertyDetailInteractionService } from 'application/services/scraper/property/property-detail-interaction.service';
import { OriginErrorDetectorService } from 'application/services/resilience/origin-error-detector.service';
import { ScraperConfig } from 'infrastructure/config/settings/scraper.config';
import { sleep } from 'infrastructure/sleep';

import type { RuntimeClient } from 'ports/outbound/browser/runtime-client.port';
jest.mock('infrastructure/sleep', () => ({
  sleep: jest.fn(async () => undefined)
}));

class ScraperConfigMockForDetailInteraction {
  readonly propertyDetailPagePreMediaExpansionWaitMs = 100;
  readonly propertyDetailPageScrollIntervalMs = 50;
  readonly propertyDetailPageImagesLoadWaitMs = 200;
  readonly propertyDetailPageScrollEvents = 1;
  readonly propertyDetailPageMorePhotosClickWaitMs = 75;
}

class OriginErrorDetectorServiceMockForDetailInteraction {
  readonly hasOriginError = jest.fn<(runtime: unknown) => Promise<boolean>>();
}

function createService() {
  const originError = new OriginErrorDetectorServiceMockForDetailInteraction();
  const service = new PropertyDetailInteractionService(
    new ScraperConfigMockForDetailInteraction() as unknown as ScraperConfig,
    originError as unknown as OriginErrorDetectorService
  );
  const logger = {
    warn: jest.fn<(message: string) => void>(),
    log: jest.fn<(message: string) => void>(),
    error: jest.fn<(message: string) => void>()
  };
  (service as unknown as { logger: typeof logger }).logger = logger;
  return { service, originError, logger };
}

function createRuntimeWithEvaluator(
  evaluator: (expression: string) => unknown
): RuntimeClient {
  return {
    evaluate: jest.fn(async (params: { expression: string }) => ({
      result: { value: evaluator(params.expression) }
    }))
  };
}

describe('PropertyDetailInteractionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('whenOriginErrorIsDetected_throwIfOriginErrorPage_shouldThrowWrongContent', async () => {
    // Arrange
    const { service, originError } = createService();
    originError.hasOriginError.mockResolvedValue(true);
    const runtime = createRuntimeWithEvaluator(() => true);
    // Action
    const action = service.throwIfOriginErrorPage(runtime);
    // Assert
    await expect(action).rejects.toThrow('Wrong content.');
  });

  it('whenOriginErrorIsNotDetected_throwIfOriginErrorPage_shouldNotThrow', async () => {
    // Arrange
    const { service, originError } = createService();
    originError.hasOriginError.mockResolvedValue(false);
    const runtime = createRuntimeWithEvaluator(() => true);
    // Action
    await service.throwIfOriginErrorPage(runtime);
    // Assert
    expect(originError.hasOriginError).toHaveBeenCalledWith(runtime);
  });

  it('whenNoMorePhotosAndNoImages_revealDetailMedia_shouldCompleteWithoutWarnings', async () => {
    // Arrange
    const { service, logger } = createService();
    const runtime = createRuntimeWithEvaluator((expression) => {
      if (expression.includes('more-photos')) {
        return false;
      }
      if (expression.includes('__fizgonImagePreloadQueue')) {
        return 0;
      }
      if (expression.includes('main.detail-container')) {
        return { total: 0, loaded: 0 };
      }
      return true;
    });
    // Action
    await service.revealDetailMedia(runtime);
    // Assert
    expect(runtime.evaluate).toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('whenMorePhotosAreAvailable_revealDetailMedia_shouldClickAndRunSecondScrollPass', async () => {
    // Arrange
    const { service } = createService();
    let clickChecks = 0;
    const runtime = createRuntimeWithEvaluator((expression) => {
      if (expression.includes('more-photos')) {
        clickChecks += 1;
        return clickChecks === 1;
      }
      if (expression.includes('__fizgonImagePreloadQueue')) {
        return 3;
      }
      if (expression.includes('main.detail-container')) {
        return { total: 2, loaded: 2 };
      }
      return true;
    });
    // Action
    await service.revealDetailMedia(runtime);
    // Assert
    expect(sleep).toHaveBeenCalledWith(75);
    expect((runtime.evaluate as jest.Mock).mock.calls.length).toBeGreaterThan(5);
  });

  it('whenImageLoadingStabilizesPartially_revealDetailMedia_shouldLogBestEffortWarning', async () => {
    // Arrange
    const { service, logger } = createService();
    const runtime = createRuntimeWithEvaluator((expression) => {
      if (expression.includes('more-photos')) {
        return false;
      }
      if (expression.includes('__fizgonImagePreloadQueue')) {
        return 2;
      }
      if (expression.includes('main.detail-container')) {
        return { total: 5, loaded: 2 };
      }
      return true;
    });
    // Action
    await service.revealDetailMedia(runtime);
    // Assert
    expect(logger.warn).toHaveBeenCalledWith(
      'Image DOM loading stabilized before full completion (2/5). Continuing with best-effort capture.'
    );
  });

  it('whenImageLoadingNeverStabilizes_revealDetailMedia_shouldLogTimeoutWarning', async () => {
    // Arrange
    const { service, logger } = createService();
    let now = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => {
      now += 2500;
      return now;
    });
    let turn = 0;
    const runtime = createRuntimeWithEvaluator((expression) => {
      if (expression.includes('more-photos')) {
        return false;
      }
      if (expression.includes('__fizgonImagePreloadQueue')) {
        return 2;
      }
      if (expression.includes('main.detail-container')) {
        turn += 1;
        return { total: 10, loaded: turn % 2 === 0 ? 2 : 1 };
      }
      return true;
    });
    // Action
    await service.revealDetailMedia(runtime);
    // Assert
    expect(logger.warn).toHaveBeenCalledWith('Timeout waiting for full image DOM load. Continuing with best-effort capture.');
  });

  it('whenPreloadQueueContainsUrls_revealDetailMedia_shouldWaitForNetworkKickoffBeforeLoadCheck', async () => {
    // Arrange
    const { service } = createService();
    const runtime = createRuntimeWithEvaluator((expression) => {
      if (expression.includes('more-photos')) {
        return false;
      }
      if (expression.includes('__fizgonImagePreloadQueue')) {
        return 4;
      }
      if (expression.includes('main.detail-container')) {
        return { total: 4, loaded: 4 };
      }
      return true;
    });
    // Action
    await service.revealDetailMedia(runtime);
    // Assert
    expect(sleep).toHaveBeenCalledWith(200);
  });
});
