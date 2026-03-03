import { RuntimeEvaluateResult } from 'src/application/services/scraper/filters/runtime-evaluate-result.type';

export type RuntimeDomain = {
  enable(): Promise<void>;
  evaluate(params: { expression: string; returnByValue?: boolean; awaitPromise?: boolean }): Promise<RuntimeEvaluateResult>;
};
