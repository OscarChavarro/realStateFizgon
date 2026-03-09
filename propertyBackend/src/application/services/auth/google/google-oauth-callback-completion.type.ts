import { AuthenticatedUser } from 'src/application/services/auth/authenticated-user.type';

export type GoogleOAuthCallbackCompletion = {
  success: boolean;
  redirectTo: string;
  error?: string;
  sessionId?: string;
  user?: AuthenticatedUser;
};
