import { RuntimeEvaluateResult } from 'src/application/services/scraper/property/runtime-evaluate-result.type';

export type RuntimeClient = {
  evaluate(params: { expression: string; returnByValue?: boolean; awaitPromise?: boolean }): Promise<RuntimeEvaluateResult>;
};
