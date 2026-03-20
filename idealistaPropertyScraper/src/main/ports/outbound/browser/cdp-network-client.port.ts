import type { UserAgentOverridePayload } from 'application/dto/browser/user-agent-override-payload.dto';

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
