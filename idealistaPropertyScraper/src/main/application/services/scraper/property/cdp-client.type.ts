import { RuntimeClient } from 'src/application/services/scraper/property/runtime-client.type';

export type CdpClient = {
  Page: {
    bringToFront(): Promise<void>;
  };
  Runtime: RuntimeClient;
};
