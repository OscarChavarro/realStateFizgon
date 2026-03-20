import type { RuntimeClient } from 'src/application/services/scraper/property/runtime-client.type';

export type PropertyCdpClient = {
  Page: {
    bringToFront(): Promise<void>;
  };
  Runtime: RuntimeClient;
};
