import { RuntimeDomain } from './runtime-domain.type';

export type CdpClient = {
  Runtime: RuntimeDomain;
  Page: {
    reload(params?: { ignoreCache?: boolean }): Promise<void>;
    loadEventFired(cb: () => void): void;
  };
};
