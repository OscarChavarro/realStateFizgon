export type UserAgentMetadata = {
  brands: { brand: string; version: string }[];
  fullVersionList?: { brand: string; version: string }[];
  platform: string;
  platformVersion: string;
  architecture: string;
  model: string;
  mobile: boolean;
  bitness?: string;
  wow64?: boolean;
};
