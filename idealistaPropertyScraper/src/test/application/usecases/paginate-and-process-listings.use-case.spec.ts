import { describe, expect, it, jest } from '@jest/globals';
import { CdpClient } from 'src/application/services/scraper/property/cdp-client.type';
import { PropertyListPageService } from 'src/application/services/scraper/property/property-list-page.service';
import { PaginateAndProcessListingsUseCase } from 'src/application/usecases/paginate-and-process-listings.use-case';
import { ChromeConfig } from 'src/infrastructure/config/settings/chrome.config';
import { ScraperConfig } from 'src/infrastructure/config/settings/scraper.config';
import { sleep } from 'src/infrastructure/sleep';

jest.mock('src/infrastructure/sleep', () => ({
  sleep: jest.fn(async () => undefined)
}));

class ChromeConfigMockForPaginateAndProcessListingsUseCase {
  readonly chromeExpressionTimeoutMs = 1000;
  readonly chromeExpressionPollIntervalMs = 10;
}

class ScraperConfigMockForPaginateAndProcessListingsUseCase {
  readonly paginationClickWaitMs = 0;
}

class PropertyListPageServiceMockForPaginateAndProcessListingsUseCase {
  readonly getPropertyUrls = jest.fn<(client: CdpClient) => Promise<string[]>>();
  readonly processUrls = jest.fn<(client: CdpClient, urls: string[]) => Promise<void>>();
}

function createClient(evaluate: CdpClient['Runtime']['evaluate']): CdpClient {
  return {
    Runtime: {
      evaluate
    },
    Page: {
      bringToFront: jest.fn(async () => undefined)
    }
  };
}

function createUseCase() {
  const propertyListPageService = new PropertyListPageServiceMockForPaginateAndProcessListingsUseCase();
  propertyListPageService.getPropertyUrls.mockResolvedValue(['https://www.idealista.com/inmueble/1/']);
  propertyListPageService.processUrls.mockResolvedValue(undefined);
  const useCase = new PaginateAndProcessListingsUseCase(
    new ChromeConfigMockForPaginateAndProcessListingsUseCase() as unknown as ChromeConfig,
    new ScraperConfigMockForPaginateAndProcessListingsUseCase() as unknown as ScraperConfig,
    propertyListPageService as unknown as PropertyListPageService
  );
  const logger = {
    warn: jest.fn<(message: string) => void>(),
    log: jest.fn<(message: string) => void>(),
    error: jest.fn<(message: string) => void>()
  };
  const captchaDetector = {
    panicIfCaptchaDetected: jest.fn<(params: unknown) => Promise<void>>()
  };
  captchaDetector.panicIfCaptchaDetected.mockResolvedValue(undefined);
  (useCase as unknown as { logger: typeof logger }).logger = logger;
  (useCase as unknown as { captchaDetectorService: typeof captchaDetector }).captchaDetectorService = captchaDetector;
  return { useCase, propertyListPageService, logger, captchaDetector };
}

describe('PaginateAndProcessListingsUseCase', () => {
  it('whenCurrentPageHasNoNextButton_execute_shouldFinishPaginationOnCurrentPage', async () => {
    // Arrange
    const { useCase, propertyListPageService, logger } = createUseCase();
    const evaluate = jest.fn<CdpClient['Runtime']['evaluate']>(async (params: { expression: string }) => {
      if (params.expression.includes('.pagination li.next')) {
        return { result: { value: false } };
      }
      return { result: { value: true } };
    });
    const client = createClient(evaluate);
    // Action
    await useCase.execute(client);
    // Assert
    expect(propertyListPageService.getPropertyUrls).toHaveBeenCalledTimes(1);
    expect(propertyListPageService.processUrls).toHaveBeenCalledTimes(1);
    expect(logger.log).toHaveBeenCalledWith('Pagination finished at page 1.');
  });

  it('whenNextExistsButClickFails_execute_shouldWarnAndStopPagination', async () => {
    // Arrange
    const { useCase, logger } = createUseCase();
    const evaluate = jest.fn<CdpClient['Runtime']['evaluate']>(async (params: { expression: string }) => {
      if (params.expression.includes('.pagination li.next') && !params.expression.includes('const next')) {
        return { result: { value: true } };
      }
      if (params.expression === 'window.location.href') {
        return { result: { value: 'https://www.idealista.com/alquiler-viviendas/' } };
      }
      if (params.expression.includes('const next = document.querySelector')) {
        return { result: { value: false } };
      }
      return { result: { value: true } };
    });
    const client = createClient(evaluate);
    // Action
    await useCase.execute(client);
    // Assert
    expect(logger.warn).toHaveBeenCalledWith('Next button exists but could not be clicked. Stopping pagination.');
  });

  it('whenNextExistsAndPageChanges_execute_shouldMoveToFollowingPageAndContinue', async () => {
    // Arrange
    const { useCase, logger, captchaDetector } = createUseCase();
    let urlCall = 0;
    let hasNextCall = 0;
    const evaluate = jest.fn<CdpClient['Runtime']['evaluate']>(async (params: { expression: string }) => {
      if (params.expression.includes('.pagination li.next') && !params.expression.includes('const next')) {
        hasNextCall += 1;
        return { result: { value: hasNextCall === 1 } };
      }
      if (params.expression === 'window.location.href') {
        urlCall += 1;
        if (urlCall <= 2) {
          return { result: { value: 'https://www.idealista.com/page-1/' } };
        }
        return { result: { value: 'https://www.idealista.com/page-2/' } };
      }
      if (params.expression.includes('const next = document.querySelector')) {
        return { result: { value: true } };
      }
      if (params.expression.includes("document.querySelector('.pagination')")) {
        return { result: { value: true } };
      }
      return { result: { value: true } };
    });
    const client = createClient(evaluate);
    // Action
    await useCase.execute(client);
    // Assert
    expect(logger.log).toHaveBeenCalledWith('Moved to page 2.');
    expect(logger.log).toHaveBeenCalledWith('Pagination finished at page 2.');
    expect(captchaDetector.panicIfCaptchaDetected).toHaveBeenCalled();
    expect((sleep as jest.Mock)).toHaveBeenCalled();
  });

  it('whenHasNextButtonEvaluationHasException_hasNextButton_shouldThrowRuntimeError', async () => {
    // Arrange
    const { useCase } = createUseCase();
    const client = createClient(jest.fn(async () => ({ exceptionDetails: { text: 'next-failed' } })));
    // Action
    const action = (useCase as unknown as { hasNextButton: (clientArg: CdpClient) => Promise<boolean> }).hasNextButton(client);
    // Assert
    await expect(action).rejects.toThrow('next-failed');
  });

  it('whenGetCurrentUrlEvaluationHasException_getCurrentUrl_shouldThrowRuntimeError', async () => {
    // Arrange
    const { useCase } = createUseCase();
    const client = createClient(jest.fn(async () => ({ exceptionDetails: { text: 'url-failed' } })));
    // Action
    const action = (useCase as unknown as { getCurrentUrl: (clientArg: CdpClient) => Promise<string> }).getCurrentUrl(client);
    // Assert
    await expect(action).rejects.toThrow('url-failed');
  });

  it('whenGetCurrentUrlEvaluationHasNoValue_getCurrentUrl_shouldFallbackToEmptyString', async () => {
    // Arrange
    const { useCase } = createUseCase();
    const client = createClient(jest.fn(async () => ({ result: {} })));
    // Action
    const currentUrl = await (useCase as unknown as { getCurrentUrl: (clientArg: CdpClient) => Promise<string> }).getCurrentUrl(client);
    // Assert
    expect(currentUrl).toBe('');
  });

  it('whenClickNextEvaluationHasException_clickNextButton_shouldThrowRuntimeError', async () => {
    // Arrange
    const { useCase } = createUseCase();
    const client = createClient(jest.fn(async () => ({ exceptionDetails: { text: 'click-failed' } })));
    // Action
    const action = (useCase as unknown as { clickNextButton: (clientArg: CdpClient) => Promise<boolean> }).clickNextButton(client);
    // Assert
    await expect(action).rejects.toThrow('click-failed');
  });

  it('whenUrlDoesNotChangeWithinTimeout_waitForUrlChange_shouldThrowTimeoutError', async () => {
    // Arrange
    const { useCase } = createUseCase();
    const client = createClient(jest.fn(async () => ({ result: { value: 'https://www.idealista.com/page-1/' } })));
    let now = 0;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
      now += 600;
      return now;
    });
    // Action
    const action = (useCase as unknown as { waitForUrlChange: (clientArg: CdpClient, previousUrl: string) => Promise<void> })
      .waitForUrlChange(client, 'https://www.idealista.com/page-1/');
    // Assert
    await expect(action).rejects.toThrow('Timeout waiting for pagination URL change from https://www.idealista.com/page-1/');
    nowSpy.mockRestore();
  });

  it('whenListingsNeverAppear_waitForListingsOrPagination_shouldThrowTimeoutError', async () => {
    // Arrange
    const { useCase } = createUseCase();
    const client = createClient(jest.fn(async () => ({ result: { value: false } })));
    let now = 0;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
      now += 600;
      return now;
    });
    // Action
    const action = (useCase as unknown as { waitForListingsOrPagination: (clientArg: CdpClient) => Promise<void> })
      .waitForListingsOrPagination(client);
    // Assert
    await expect(action).rejects.toThrow('Timeout waiting for listings/pagination after moving to next page.');
    nowSpy.mockRestore();
  });

  it('whenListingsEvaluationHasException_waitForListingsOrPagination_shouldThrowRuntimeError', async () => {
    // Arrange
    const { useCase } = createUseCase();
    const client = createClient(jest.fn(async () => ({ exceptionDetails: { text: 'listings-failed' } })));
    // Action
    const action = (useCase as unknown as { waitForListingsOrPagination: (clientArg: CdpClient) => Promise<void> })
      .waitForListingsOrPagination(client);
    // Assert
    await expect(action).rejects.toThrow('listings-failed');
  });
});
