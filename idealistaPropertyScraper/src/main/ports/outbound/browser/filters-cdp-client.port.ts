import type { RuntimeDomain } from 'ports/outbound/browser/runtime-domain.port';

export type FiltersCdpClient = {
  Runtime: RuntimeDomain;
  Page: {
    reload(params?: { ignoreCache?: boolean }): Promise<void>;
    loadEventFired(cb: () => void): void;
  };
};
