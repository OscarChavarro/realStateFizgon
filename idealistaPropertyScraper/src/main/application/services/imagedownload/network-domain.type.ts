export type NetworkDomain = {
  enable(): Promise<void>;
  responseReceived(callback: (event: unknown) => void): void;
  loadingFinished(callback: (event: unknown) => void): void;
  loadingFailed(callback: (event: unknown) => void): void;
  getResponseBody(params: { requestId: string }): Promise<{ body: string; base64Encoded: boolean }>;
};
