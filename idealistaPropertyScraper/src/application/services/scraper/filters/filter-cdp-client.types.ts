export type RuntimeEvaluateResult = {
  exceptionDetails?: {
    text?: string;
  };
  result?: {
    value?: unknown;
  };
};

export type CdpClient = {
  Runtime: {
    evaluate(params: { expression: string; returnByValue?: boolean; awaitPromise?: boolean }): Promise<RuntimeEvaluateResult>;
  };
  Page: {
    reload(params?: { ignoreCache?: boolean }): Promise<void>;
    loadEventFired(cb: () => void): void;
  };
};

export type MinMaxSelection = {
  selectedMin: string | null;
  selectedMax: string | null;
};
