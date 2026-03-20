export type ChromeGeolocationOverride = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

export interface ChromeSettingsPort {
  readonly chromeBinary: string;
  readonly chromePath: string;
  readonly chromeUserAgent: string;
  readonly chromeAcceptLanguage: string;
  readonly chromeExtraHeaders: Record<string, string>;
  readonly chromiumOptions: string[];
  readonly proxyEnabled: boolean;
  readonly proxyHost: string;
  readonly proxyPort: number;
  readonly geolocationOverride: ChromeGeolocationOverride | undefined;
  readonly geolocationAllowlist: string[];
  readonly chromeCdpReadyTimeoutMs: number;
  readonly chromeCdpRequestTimeoutMs: number;
  readonly chromeCdpPollIntervalMs: number;
  readonly chromeOriginErrorReloadWaitMs: number;
  readonly chromeExpressionTimeoutMs: number;
  readonly chromeExpressionPollIntervalMs: number;
  readonly chromeBrowserLaunchRetryWaitMs: number;
}
