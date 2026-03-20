import { RuntimeDomain } from 'application/services/scraper/filters/runtime-domain.type';

export type FiltersCdpClient = {
  Runtime: RuntimeDomain;
  Page: {
    reload(params?: { ignoreCache?: boolean }): Promise<void>;
    loadEventFired(cb: () => void): void;
  };
};
