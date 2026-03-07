import { Injectable } from '@nestjs/common';
import { sleep } from 'src/infrastructure/sleep';

type CdpPageDomain = {
  loadEventFired(cb: () => void): void;
};

type CdpRuntimeDomain = {
  evaluate(params: { expression: string; returnByValue?: boolean; awaitPromise?: boolean }): Promise<{
    exceptionDetails?: { text?: string };
    result?: { value?: unknown };
  }>;
};

@Injectable()
export class ChromiumPageSyncService {
  async waitForPageLoad(
    page: CdpPageDomain,
    runtime?: CdpRuntimeDomain,
    timeoutMs = 30000,
    pollIntervalMs = 100
  ): Promise<void> {
    const safeTimeoutMs = Math.max(1000, timeoutMs);
    const safePollIntervalMs = Math.max(50, pollIntervalMs);
    const start = Date.now();
    let loadEventReceived = false;

    if (runtime && await this.isDocumentReady(runtime)) {
      return;
    }

    page.loadEventFired(() => {
      loadEventReceived = true;
    });

    if (runtime && await this.isDocumentReady(runtime)) {
      return;
    }

    while (Date.now() - start < safeTimeoutMs) {
      if (loadEventReceived) {
        return;
      }

      if (runtime && await this.isDocumentReady(runtime)) {
        return;
      }

      await sleep(safePollIntervalMs);
    }

    throw new Error(`Timeout waiting for page load after ${safeTimeoutMs}ms.`);
  }

  async waitForExpression(
    runtime: { evaluate(params: { expression: string; returnByValue?: boolean }): Promise<{ result?: { value?: unknown } }> },
    expression: string,
    timeoutMs: number,
    pollIntervalMs: number
  ): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const evaluation = await runtime.evaluate({
        expression,
        returnByValue: true
      });

      if (evaluation.result?.value === true) {
        return;
      }

      await sleep(pollIntervalMs);
    }

    throw new Error(`Timeout waiting for expression: ${expression}`);
  }

  async sleep(ms: number): Promise<void> {
    await sleep(ms);
  }

  private async isDocumentReady(runtime: CdpRuntimeDomain): Promise<boolean> {
    try {
      const evaluation = await runtime.evaluate({
        expression: "document.readyState === 'complete'",
        returnByValue: true
      });

      if (evaluation.exceptionDetails?.text) {
        return false;
      }

      return evaluation.result?.value === true;
    } catch {
      return false;
    }
  }
}
