import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Configuration } from 'src/infrastructure/config/configuration';
import { AuthenticatedUser } from 'src/application/services/auth/authenticated-user.type';

type AuthSession = {
  id: string;
  user: AuthenticatedUser;
  expiresAtMs: number;
};

@Injectable()
export class AuthSessionService {
  private readonly sessions = new Map<string, AuthSession>();

  constructor(private readonly configuration: Configuration) {}

  get sessionCookieName(): string {
    return this.configuration.authSessionCookieName;
  }

  get sessionTtlSeconds(): number {
    return this.configuration.authSessionTtlSeconds;
  }

  get sessionSecureCookie(): boolean {
    return this.configuration.authSessionSecureCookie;
  }

  createSession(user: AuthenticatedUser): AuthSession {
    this.cleanupExpiredSessions();
    const now = Date.now();
    const session: AuthSession = {
      id: randomUUID(),
      user,
      expiresAtMs: now + (this.sessionTtlSeconds * 1000)
    };
    this.sessions.set(session.id, session);
    return session;
  }

  findUserByCookieHeader(cookieHeaderRaw: string | undefined): AuthenticatedUser | null {
    const session = this.findSessionByCookieHeader(cookieHeaderRaw);
    return session?.user ?? null;
  }

  findSessionByCookieHeader(cookieHeaderRaw: string | undefined): AuthSession | null {
    this.cleanupExpiredSessions();
    const sessionId = this.extractSessionIdFromCookie(cookieHeaderRaw);
    if (!sessionId) {
      return null;
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    if (session.expiresAtMs <= Date.now()) {
      this.sessions.delete(session.id);
      return null;
    }

    return session;
  }

  destroySessionByCookieHeader(cookieHeaderRaw: string | undefined): void {
    const sessionId = this.extractSessionIdFromCookie(cookieHeaderRaw);
    if (!sessionId) {
      return;
    }

    this.sessions.delete(sessionId);
  }

  private extractSessionIdFromCookie(cookieHeaderRaw: string | undefined): string | null {
    if (!cookieHeaderRaw || cookieHeaderRaw.trim().length === 0) {
      return null;
    }

    const cookiePairs = cookieHeaderRaw.split(';');
    for (const pair of cookiePairs) {
      const [nameRaw, ...valueRawParts] = pair.split('=');
      const name = (nameRaw ?? '').trim();
      if (name !== this.sessionCookieName) {
        continue;
      }

      const value = valueRawParts.join('=').trim();
      if (!value) {
        return null;
      }

      return value;
    }

    return null;
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAtMs <= now) {
        this.sessions.delete(sessionId);
      }
    }
  }
}
