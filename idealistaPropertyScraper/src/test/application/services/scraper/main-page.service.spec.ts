import { describe, expect, it, jest } from '@jest/globals';
import { MainPageService } from 'src/application/services/scraper/main-page.service';
import { CdpClient } from 'src/application/services/scraper/filters/cdp-client.type';
import { OriginErrorDetectorService } from 'src/application/services/resilience/origin-error-detector.service';
import { ScraperConfig } from 'src/infrastructure/config/settings/scraper.config';

class ScraperConfigMockForMainPage {
  readonly mainPageExpressionTimeoutMs = 5000;
  readonly mainPageExpressionPollIntervalMs = 50;
  readonly mainPageSearchClickWaitMs = 0;
}

class OriginErrorDetectorServiceMock {
  readonly buildConditionExpression = jest.fn<(title: string, text: string) => string>();
}

function createClient(evaluate: CdpClient['Runtime']['evaluate']): CdpClient {
  return {
    Runtime: {
      enable: jest.fn(async () => undefined),
      evaluate
    },
    Page: {
      reload: jest.fn(async () => undefined),
      loadEventFired: jest.fn()
    }
  };
}

describe('MainPageService', () => {
  it('whenMainPageFlowSucceeds_execute_shouldCompleteAllAutomationSteps', async () => {
    // Arrange
    const originErrorDetector = new OriginErrorDetectorServiceMock();
    originErrorDetector.buildConditionExpression.mockReturnValue('false');
    const service = new MainPageService(
      new ScraperConfigMockForMainPage() as unknown as ScraperConfig,
      originErrorDetector as unknown as OriginErrorDetectorService
    );
    const evaluate = jest.fn<CdpClient['Runtime']['evaluate']>(async (params: { expression: string }) => {
      if (params.expression.includes('return { matched, hasOriginError')) {
        return { result: { value: { matched: true, hasOriginError: false, currentUrl: 'https://idealista.com', title: 'ok' } } };
      }
      return { result: { value: true } };
    });
    const client = createClient(evaluate);
    // Action
    await service.execute(client, 'Madrid', 'https://www.idealista.com/');
    // Assert
    expect(client.Runtime.enable).toHaveBeenCalledTimes(1);
    expect(originErrorDetector.buildConditionExpression).toHaveBeenCalled();
    expect(evaluate).toHaveBeenCalled();
  });

  it('whenOriginErrorIsDetected_waitForExpression_shouldThrowError', async () => {
    // Arrange
    const originErrorDetector = new OriginErrorDetectorServiceMock();
    originErrorDetector.buildConditionExpression.mockReturnValue('true');
    const service = new MainPageService(
      new ScraperConfigMockForMainPage() as unknown as ScraperConfig,
      originErrorDetector as unknown as OriginErrorDetectorService
    );
    const client = createClient(jest.fn(async () => ({
      result: { value: { matched: false, hasOriginError: true, currentUrl: 'https://x', title: 'err' } }
    })));
    // Action
    const action = (service as unknown as { waitForExpression: (clientArg: CdpClient, expression: string) => Promise<void> })
      .waitForExpression(client, 'true');
    // Assert
    await expect(action).rejects.toThrow('Origin error page detected while waiting for expression: true');
  });

  it('whenRuntimeReturnsErrorDescription_evaluateOrThrow_shouldThrowError', async () => {
    // Arrange
    const originErrorDetector = new OriginErrorDetectorServiceMock();
    originErrorDetector.buildConditionExpression.mockReturnValue('false');
    const service = new MainPageService(
      new ScraperConfigMockForMainPage() as unknown as ScraperConfig,
      originErrorDetector as unknown as OriginErrorDetectorService
    );
    const client = createClient(jest.fn(async () => ({ result: { description: 'Error: click failed' } })));
    // Action
    const action = (service as unknown as { evaluateOrThrow: (clientArg: CdpClient, expression: string) => Promise<void> })
      .evaluateOrThrow(client, 'true');
    // Assert
    await expect(action).rejects.toThrow('Error: click failed');
  });

  it('whenExpressionEvaluationThrowsException_waitForExpression_shouldThrowError', async () => {
    // Arrange
    const originErrorDetector = new OriginErrorDetectorServiceMock();
    originErrorDetector.buildConditionExpression.mockReturnValue('false');
    const service = new MainPageService(
      new ScraperConfigMockForMainPage() as unknown as ScraperConfig,
      originErrorDetector as unknown as OriginErrorDetectorService
    );
    const client = createClient(jest.fn(async () => ({ exceptionDetails: { text: 'runtime-failed' } })));
    // Action
    const action = (service as unknown as { waitForExpression: (clientArg: CdpClient, expression: string) => Promise<void> })
      .waitForExpression(client, 'true');
    // Assert
    await expect(action).rejects.toThrow('runtime-failed');
  });

  it('whenExpressionDoesNotMatch_waitForExpression_shouldThrowTimeoutWithLastUrlAndTitle', async () => {
    // Arrange
    const originErrorDetector = new OriginErrorDetectorServiceMock();
    originErrorDetector.buildConditionExpression.mockReturnValue('false');
    const service = new MainPageService(
      new ScraperConfigMockForMainPage() as unknown as ScraperConfig,
      originErrorDetector as unknown as OriginErrorDetectorService
    );
    const evaluate = jest.fn<CdpClient['Runtime']['evaluate']>(async () => ({
      result: { value: { matched: false, hasOriginError: false, currentUrl: 'https://x', title: 'loading' } }
    }));
    const client = createClient(evaluate);
    let now = 0;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
      now += 3000;
      return now;
    });
    // Action
    const action = (service as unknown as { waitForExpression: (clientArg: CdpClient, expression: string) => Promise<void> })
      .waitForExpression(client, 'false');
    // Assert
    await expect(action).rejects.toThrow('Timeout waiting for expression: false. Last URL="https://x", title="loading".');
    nowSpy.mockRestore();
  });

  it('whenRuntimeReturnsExceptionDetails_evaluateOrThrow_shouldThrowRuntimeError', async () => {
    // Arrange
    const originErrorDetector = new OriginErrorDetectorServiceMock();
    originErrorDetector.buildConditionExpression.mockReturnValue('false');
    const service = new MainPageService(
      new ScraperConfigMockForMainPage() as unknown as ScraperConfig,
      originErrorDetector as unknown as OriginErrorDetectorService
    );
    const client = createClient(jest.fn(async () => ({ exceptionDetails: { text: 'click exploded' } })));
    // Action
    const action = (service as unknown as { evaluateOrThrow: (clientArg: CdpClient, expression: string) => Promise<void> })
      .evaluateOrThrow(client, 'true');
    // Assert
    await expect(action).rejects.toThrow('click exploded');
  });
});
