import { UserAgentMetadata } from 'src/application/services/chromium/user-agent-metadata.type';

export type UserAgentOverridePayload = {
  userAgent: string;
  acceptLanguage?: string;
  platform?: string;
  userAgentMetadata?: UserAgentMetadata;
};
