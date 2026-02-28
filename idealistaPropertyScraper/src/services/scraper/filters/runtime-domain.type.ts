import { RuntimeEvaluateResult } from './runtime-evaluate-result.type';

export type RuntimeDomain = {
  enable(): Promise<void>;
  evaluate(params: { expression: string; returnByValue?: boolean; awaitPromise?: boolean }): Promise<RuntimeEvaluateResult>;
};
