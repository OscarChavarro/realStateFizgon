export type GoogleOAuthBootstrapResult = {
  enabled: boolean;
  authorizationUrl: string | null;
  message: string;
  missingConfigFields: string[];
};
