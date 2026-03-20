import type { RuntimeEvaluateResult } from 'application/dto/browser/runtime-evaluate-result.dto';

export type RuntimeClient = {
  evaluate(params: { expression: string; returnByValue?: boolean; awaitPromise?: boolean }): Promise<RuntimeEvaluateResult>;
};
