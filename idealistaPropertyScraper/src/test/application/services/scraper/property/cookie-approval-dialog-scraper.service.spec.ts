import { describe, expect, it, jest } from '@jest/globals';
import { CookieApprovalDialogScraperService } from 'application/services/scraper/property/cookie-approval-dialog-scraper.service';
import { ScraperConfig } from 'infrastructure/config/settings/scraper.config';
import { sleep } from 'infrastructure/sleep';

jest.mock('infrastructure/sleep', () => ({
  sleep: jest.fn(async () => undefined)
}));

class ScraperConfigMockForCookieApproval {
  readonly cookieApprovalDialogWaitMs = 120;
}

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

describe('CookieApprovalDialogScraperService', () => {
  it('whenDialogIsNotVisible_acceptCookiesIfVisible_shouldSkipWaits', async () => {
    // Arrange
    const runtime = createRuntime(false);
    const service = new CookieApprovalDialogScraperService(
      new ScraperConfigMockForCookieApproval() as unknown as ScraperConfig
    );
    // Action
    await service.acceptCookiesIfVisible(runtime);
    // Assert
    expect(runtime.evaluate).toHaveBeenCalledWith(expect.objectContaining({ returnByValue: true }));
    expect(sleep).not.toHaveBeenCalled();
  });

  it('whenDialogIsVisible_acceptCookiesIfVisible_shouldClickAndWaitTwice', async () => {
    // Arrange
    const runtime = createRuntime(true);
    const service = new CookieApprovalDialogScraperService(
      new ScraperConfigMockForCookieApproval() as unknown as ScraperConfig
    );
    // Action
    await service.acceptCookiesIfVisible(runtime);
    // Assert
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(120);
  });
});
