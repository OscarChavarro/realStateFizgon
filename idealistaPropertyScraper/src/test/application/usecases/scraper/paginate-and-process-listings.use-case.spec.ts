import { describe, expect, it, jest } from '@jest/globals';
import { createScrapeRunContext, ScrapeRunContext } from 'application/context/scrape-run-context';
import { PropertyListPageService } from 'application/services/scraper/property/property-list-page.service';
import { PaginateAndProcessListingsUseCase } from 'application/usecases/scraper/paginate-and-process-listings.use-case';
import { ChromeConfig } from 'infrastructure/config/settings/chrome.config';
import { ScraperConfig } from 'infrastructure/config/settings/scraper.config';

import type { CaptchaDetectorPort } from 'ports/outbound/captcha/captcha-detector.port';
import type { PropertyCdpClient } from 'ports/outbound/browser/property-cdp-client.port';
import type { SleepPort } from 'ports/outbound/timing/sleep.port';

class ChromeConfigMockForPaginateAndProcessListingsUseCase {
  readonly chromeExpressionTimeoutMs = 1000;
  readonly chromeExpressionPollIntervalMs = 10;
}

class ScraperConfigMockForPaginateAndProcessListingsUseCase {
  readonly paginationClickWaitMs = 0;
}

class PropertyListPageServiceMockForPaginateAndProcessListingsUseCase {
  readonly getPropertyUrls = jest.fn<(client: PropertyCdpClient) => Promise<string[]>>();
  readonly processUrls = jest.fn<
    (client: PropertyCdpClient, urls: string[], scrapeRunContext: ScrapeRunContext) => Promise<void>
  >();
}

class SleepPortMockForPaginateAndProcessListingsUseCase implements SleepPort {
  readonly sleep = jest.fn<(ms: number) => Promise<void>>();
}

class CaptchaDetectorPortMockForPaginateAndProcessListingsUseCase implements CaptchaDetectorPort {
  readonly panicIfCaptchaDetected = jest.fn(async () => undefined);
}

function createClient(evaluate: PropertyCdpClient['Runtime']['evaluate']): PropertyCdpClient {
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
  const sleepPort = new SleepPortMockForPaginateAndProcessListingsUseCase();
  const clockPort = {
    nowMs: jest.fn<() => number>().mockReturnValue(0)
  };
  const captchaDetectorPort = new CaptchaDetectorPortMockForPaginateAndProcessListingsUseCase();
  propertyListPageService.getPropertyUrls.mockResolvedValue(['https://www.idealista.com/inmueble/1/']);
  propertyListPageService.processUrls.mockResolvedValue(undefined);
  sleepPort.sleep.mockResolvedValue(undefined);
  captchaDetectorPort.panicIfCaptchaDetected.mockResolvedValue(undefined);
  const useCase = new PaginateAndProcessListingsUseCase(
    new ChromeConfigMockForPaginateAndProcessListingsUseCase() as unknown as ChromeConfig,
    new ScraperConfigMockForPaginateAndProcessListingsUseCase() as unknown as ScraperConfig,
    propertyListPageService as unknown as PropertyListPageService,
    captchaDetectorPort,
    clockPort as never,
    sleepPort
  );
  const logger = {
    warn: jest.fn<(message: string) => void>(),
    log: jest.fn<(message: string) => void>(),
    error: jest.fn<(message: string) => void>()
  };
  (useCase as unknown as { logger: typeof logger }).logger = logger;
  return { useCase, propertyListPageService, sleepPort, logger, captchaDetectorPort, clockPort };
}

describe('PaginateAndProcessListingsUseCase', () => {
  it('whenCurrentPageHasNoNextButton_execute_shouldFinishPaginationOnCurrentPage', async () => {
    // Arrange
    const { useCase, propertyListPageService, logger } = createUseCase();
    const evaluate = jest.fn<PropertyCdpClient['Runtime']['evaluate']>(async (params: { expression: string }) => {
      if (params.expression.includes('.pagination li.next')) {
        return { result: { value: false } };
      }
      return { result: { value: true } };
    });
    const client = createClient(evaluate);
    const scrapeRunContext = createScrapeRunContext();
    // Action
    await useCase.execute(client, scrapeRunContext);
    // Assert
    expect(propertyListPageService.getPropertyUrls).toHaveBeenCalledTimes(1);
    expect(propertyListPageService.processUrls).toHaveBeenCalledTimes(1);
    expect(logger.log).toHaveBeenCalledWith('Pagination finished at page 1.');
  });

  it('whenNextExistsButClickFails_execute_shouldWarnAndStopPagination', async () => {
    // Arrange
    const { useCase, logger } = createUseCase();
    const evaluate = jest.fn<PropertyCdpClient['Runtime']['evaluate']>(async (params: { expression: string }) => {
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
    const scrapeRunContext = createScrapeRunContext();
    // Action
    await useCase.execute(client, scrapeRunContext);
    // Assert
    expect(logger.warn).toHaveBeenCalledWith('Next button exists but could not be clicked. Stopping pagination.');
  });

  it('whenNextExistsAndPageChanges_execute_shouldMoveToFollowingPageAndContinue', async () => {
    // Arrange
    const { useCase, logger, sleepPort, captchaDetectorPort } = createUseCase();
    let urlCall = 0;
    let hasNextCall = 0;
    const evaluate = jest.fn<PropertyCdpClient['Runtime']['evaluate']>(async (params: { expression: string }) => {
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
    const scrapeRunContext = createScrapeRunContext();
    // Action
    await useCase.execute(client, scrapeRunContext);
    // Assert
    expect(logger.log).toHaveBeenCalledWith('Moved to page 2.');
    expect(logger.log).toHaveBeenCalledWith('Pagination finished at page 2.');
    expect(captchaDetectorPort.panicIfCaptchaDetected).toHaveBeenCalled();
    expect(sleepPort.sleep).toHaveBeenCalled();
  });

  it('whenHasNextButtonEvaluationHasException_hasNextButton_shouldThrowRuntimeError', async () => {
    // Arrange
    const { useCase } = createUseCase();
    const client = createClient(jest.fn(async () => ({ exceptionDetails: { text: 'next-failed' } })));
    // Action
    const action = (useCase as unknown as { hasNextButton: (clientArg: PropertyCdpClient) => Promise<boolean> }).hasNextButton(client);
    // Assert
    await expect(action).rejects.toThrow('next-failed');
  });

  it('whenGetCurrentUrlEvaluationHasException_getCurrentUrl_shouldThrowRuntimeError', async () => {
    // Arrange
    const { useCase } = createUseCase();
    const client = createClient(jest.fn(async () => ({ exceptionDetails: { text: 'url-failed' } })));
    // Action
    const action = (useCase as unknown as { getCurrentUrl: (clientArg: PropertyCdpClient) => Promise<string> }).getCurrentUrl(client);
    // Assert
    await expect(action).rejects.toThrow('url-failed');
  });

  it('whenGetCurrentUrlEvaluationHasNoValue_getCurrentUrl_shouldFallbackToEmptyString', async () => {
    // Arrange
    const { useCase } = createUseCase();
    const client = createClient(jest.fn(async () => ({ result: {} })));
    // Action
    const currentUrl = await (useCase as unknown as { getCurrentUrl: (clientArg: PropertyCdpClient) => Promise<string> }).getCurrentUrl(client);
    // Assert
    expect(currentUrl).toBe('');
  });

  it('whenClickNextEvaluationHasException_clickNextButton_shouldThrowRuntimeError', async () => {
    // Arrange
    const { useCase } = createUseCase();
    const client = createClient(jest.fn(async () => ({ exceptionDetails: { text: 'click-failed' } })));
    // Action
    const action = (useCase as unknown as { clickNextButton: (clientArg: PropertyCdpClient) => Promise<boolean> }).clickNextButton(client);
    // Assert
    await expect(action).rejects.toThrow('click-failed');
  });

  it('whenUrlDoesNotChangeWithinTimeout_waitForUrlChange_shouldThrowTimeoutError', async () => {
    // Arrange
    const { useCase, clockPort } = createUseCase();
    const client = createClient(jest.fn(async () => ({ result: { value: 'https://www.idealista.com/page-1/' } })));
    let now = 0;
    clockPort.nowMs.mockImplementation(() => {
      now += 600;
      return now;
    });
    // Action
    const action = (useCase as unknown as { waitForUrlChange: (clientArg: PropertyCdpClient, previousUrl: string) => Promise<void> })
      .waitForUrlChange(client, 'https://www.idealista.com/page-1/');
    // Assert
    await expect(action).rejects.toThrow('Timeout waiting for pagination URL change from https://www.idealista.com/page-1/');
  });

  it('whenListingsNeverAppear_waitForListingsOrPagination_shouldThrowTimeoutError', async () => {
    // Arrange
    const { useCase, clockPort } = createUseCase();
    const client = createClient(jest.fn(async () => ({ result: { value: false } })));
    let now = 0;
    clockPort.nowMs.mockImplementation(() => {
      now += 600;
      return now;
    });
    // Action
    const action = (useCase as unknown as { waitForListingsOrPagination: (clientArg: PropertyCdpClient) => Promise<void> })
      .waitForListingsOrPagination(client);
    // Assert
    await expect(action).rejects.toThrow('Timeout waiting for listings/pagination after moving to next page.');
  });

  it('whenListingsEvaluationHasException_waitForListingsOrPagination_shouldThrowRuntimeError', async () => {
    // Arrange
    const { useCase } = createUseCase();
    const client = createClient(jest.fn(async () => ({ exceptionDetails: { text: 'listings-failed' } })));
    // Action
    const action = (useCase as unknown as { waitForListingsOrPagination: (clientArg: PropertyCdpClient) => Promise<void> })
      .waitForListingsOrPagination(client);
    // Assert
    await expect(action).rejects.toThrow('listings-failed');
  });
});
