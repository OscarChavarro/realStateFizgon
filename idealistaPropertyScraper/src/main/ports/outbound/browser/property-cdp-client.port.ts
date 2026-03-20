import type { RuntimeClient } from 'src/ports/outbound/browser/runtime-client.port';

export type PropertyCdpClient = {
  Page: {
    bringToFront(): Promise<void>;
  };
  Runtime: RuntimeClient;
};
