export type RuntimeEvaluateResult = {
  exceptionDetails?: {
    text?: string;
  };
  result?: {
    description?: string;
    value?: unknown;
  };
};
