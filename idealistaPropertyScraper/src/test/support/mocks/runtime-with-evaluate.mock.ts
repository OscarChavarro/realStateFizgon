import { jest } from '@jest/globals';

type RuntimeEvaluateParams = {
  expression: string;
  returnByValue?: boolean;
  awaitPromise?: boolean;
};

type RuntimeEvaluateResult = {
  result?: {
    value?: unknown;
  };
};

export class RuntimeWithEvaluateMock {
  readonly evaluate = jest.fn<(
    params: RuntimeEvaluateParams
  ) => Promise<RuntimeEvaluateResult>>();
}
