import { describe, expect, it, jest } from '@jest/globals';
import { CookieApprovalDialogScraperService } from 'application/services/scraper/property/cookie-approval-dialog-scraper.service';
import { ScraperConfig } from 'infrastructure/config/settings/scraper.config';

class ScraperConfigMockForCookieApproval {
  readonly cookieApprovalDialogWaitMs = 120;
}

type SleepPortMock = {
  sleep: jest.Mock<(ms: number) => Promise<void>>;
};

type RuntimeClientMock = {
  evaluate: jest.Mock<(
    params: { expression: string; returnByValue?: boolean }
  ) => Promise<{ result?: { value?: unknown } }>>;
};

function createRuntime(value: boolean): RuntimeClientMock {
  return {
    evaluate: jest.fn(async () => ({ result: { value } }))
  };
}

function createSleepPort(): SleepPortMock {
  return {
    sleep: jest.fn(async () => undefined)
  };
}

describe('CookieApprovalDialogScraperService', () => {
  it('whenDialogIsNotVisible_acceptCookiesIfVisible_shouldSkipWaits', async () => {
    // Arrange
    const runtime = createRuntime(false);
    const sleepPort = createSleepPort();
    const service = new CookieApprovalDialogScraperService(
      new ScraperConfigMockForCookieApproval() as unknown as ScraperConfig,
      sleepPort as never
    );
    // Action
    await service.acceptCookiesIfVisible(runtime);
    // Assert
    expect(runtime.evaluate).toHaveBeenCalledWith(expect.objectContaining({ returnByValue: true }));
    expect(sleepPort.sleep).not.toHaveBeenCalled();
  });

  it('whenDialogIsVisible_acceptCookiesIfVisible_shouldClickAndWaitTwice', async () => {
    // Arrange
    const runtime = createRuntime(true);
    const sleepPort = createSleepPort();
    const service = new CookieApprovalDialogScraperService(
      new ScraperConfigMockForCookieApproval() as unknown as ScraperConfig,
      sleepPort as never
    );
    // Action
    await service.acceptCookiesIfVisible(runtime);
    // Assert
    expect(sleepPort.sleep).toHaveBeenCalledTimes(2);
    expect(sleepPort.sleep).toHaveBeenCalledWith(120);
  });
});
