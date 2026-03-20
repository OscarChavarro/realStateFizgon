export type CaptchaRuntimePort = {
  evaluate(params: { expression: string; returnByValue?: boolean }): Promise<{ result?: { value?: unknown } }>;
};

export type CaptchaDetectionLogger = {
  log(message: string): void;
  warn?(message: string): void;
  error(message: string): void;
};

export type CaptchaDetectionRequest = {
  runtime: CaptchaRuntimePort;
  logger?: CaptchaDetectionLogger;
  waitMs?: number;
  context?: string;
};

export interface CaptchaDetectorPort {
  panicIfCaptchaDetected(request: CaptchaDetectionRequest): Promise<void>;
}
