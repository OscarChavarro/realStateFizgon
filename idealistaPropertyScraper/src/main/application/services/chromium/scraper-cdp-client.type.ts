import { NetworkDomain } from 'src/application/services/imagedownload/network-domain.type';
import { RuntimeClient } from 'src/application/services/scraper/property/runtime-client.type';

export type ScraperCdpClient = {
  Browser?: {
    grantPermissions?(params: { origin: string; permissions: string[] }): Promise<void>;
  };
  Emulation?: {
    setGeolocationOverride?(params: { latitude: number; longitude: number; accuracy: number }): Promise<void>;
    setUserAgentOverride?(params: {
      userAgent: string;
      acceptLanguage?: string;
      platform?: string;
      userAgentMetadata?: unknown;
    }): Promise<void>;
  };
  Page: {
    enable(): Promise<void>;
    bringToFront(): Promise<void>;
    navigate(params: { url: string }): Promise<void>;
    reload(params?: { ignoreCache?: boolean }): Promise<void>;
    loadEventFired(cb: () => void): void;
    frameNavigated(cb: (event: { frame?: { url?: string } }) => void): void;
  };
  Runtime: RuntimeClient & {
    enable(): Promise<void>;
  };
  Network: NetworkDomain;
  close(): Promise<void>;
};
