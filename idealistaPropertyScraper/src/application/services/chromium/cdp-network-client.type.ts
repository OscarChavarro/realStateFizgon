import { UserAgentOverridePayload } from 'src/application/services/chromium/user-agent-override-payload.type';

export type CdpNetworkClient = {
  Network?: {
    enable?: () => Promise<void>;
    setExtraHTTPHeaders?: (params: { headers: Record<string, string> }) => Promise<void>;
    setUserAgentOverride?: (params: UserAgentOverridePayload) => Promise<void>;
  };
  Emulation?: {
    setUserAgentOverride?: (params: UserAgentOverridePayload) => Promise<void>;
  };
};
