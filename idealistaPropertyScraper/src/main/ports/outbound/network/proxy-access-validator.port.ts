export type ProxyValidationLogger = {
  log(message: string): void;
  error(message: string): void;
};

export type ProxyAccessValidationRequest = {
  enabled: boolean;
  host: string;
  port: number | string;
  retryWaitMs: number;
  connectTimeoutMs?: number;
  quickRetryCount?: number;
  quickRetryDelayMs?: number;
  testConnectHost?: string;
  testConnectPort?: number;
  logger?: ProxyValidationLogger;
};

export interface ProxyAccessValidatorPort {
  validateProxyAccessOrWait(request: ProxyAccessValidationRequest): Promise<void>;
}
