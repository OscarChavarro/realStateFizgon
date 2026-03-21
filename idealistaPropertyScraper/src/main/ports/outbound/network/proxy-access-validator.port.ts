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
};

export type ProxyAccessValidationResult =
  | {
      status: 'proxy_disabled';
      enabled: false;
    }
  | {
      status: 'proxy_validated';
      enabled: true;
      host: string;
      port: number | string;
    };

export interface ProxyAccessValidatorPort {
  validateProxyAccessOrWait(request: ProxyAccessValidationRequest): Promise<ProxyAccessValidationResult>;
}
