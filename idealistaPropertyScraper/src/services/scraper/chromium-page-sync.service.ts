import { Injectable } from '@nestjs/common';

@Injectable()
export class ChromiumPageSyncService {
  async waitForPageLoad(page: { loadEventFired(cb: () => void): void }): Promise<void> {
    await new Promise<void>((resolve) => {
      page.loadEventFired(() => resolve());
    });
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

      await this.sleep(pollIntervalMs);
    }

    throw new Error(`Timeout waiting for expression: ${expression}`);
  }

  async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
