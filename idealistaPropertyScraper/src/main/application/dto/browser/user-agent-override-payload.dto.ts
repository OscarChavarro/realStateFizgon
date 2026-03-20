import type { UserAgentMetadata } from 'application/dto/browser/user-agent-metadata.dto';

export type UserAgentOverridePayload = {
  userAgent: string;
  acceptLanguage?: string;
  platform?: string;
  userAgentMetadata?: UserAgentMetadata;
};
