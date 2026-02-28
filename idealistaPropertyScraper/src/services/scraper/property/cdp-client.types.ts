export type RuntimeEvaluateResult = {
  exceptionDetails?: {
    text?: string;
  };
  result?: {
    value?: unknown;
  };
};

export type RuntimeClient = {
  evaluate(params: { expression: string; returnByValue?: boolean; awaitPromise?: boolean }): Promise<RuntimeEvaluateResult>;
};

export type CdpClient = {
  Page: {
    bringToFront(): Promise<void>;
  };
  Runtime: RuntimeClient;
};
