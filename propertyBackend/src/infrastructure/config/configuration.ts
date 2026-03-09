import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

type Environment = {
  api?: {
    port?: number;
  };
  images?: {
    downloadFolder?: string;
  };
};

type Secrets = {
  mongodb?: {
    host?: string;
    port?: number;
    database?: string;
    authSource?: string;
    user?: string;
    password?: string;
  };
  auth?: {
    google?: {
      clientId?: string;
      clientSecret?: string;
      redirectUri?: string;
      scope?: string;
      prompt?: string;
    };
    frontendBaseUrl?: string;
    session?: {
      cookieName?: string;
      ttlSeconds?: number;
      secureCookie?: boolean;
    };
  };
};

@Injectable()
export class Configuration {
  private readonly environment: Environment;
  private readonly secrets: Secrets;

  constructor() {
    const raw = readFileSync(join(process.cwd(), 'environment.json'), 'utf-8');
    this.environment = JSON.parse(raw) as Environment;

    const secretsPath = join(process.cwd(), 'secrets.json');
    if (!existsSync(secretsPath)) {
      console.log('Copy secrets-example.json to secrets.json and define external services credentials for this micro service.');
      process.exit(1);
    }

    const secretsRaw = readFileSync(secretsPath, 'utf-8');
    this.secrets = JSON.parse(secretsRaw) as Secrets;
  }

  get apiPort(): number {
    return Math.max(1, this.environment.api?.port ?? 8081);
  }

  get imageDownloadFolder(): string {
    return this.environment.images?.downloadFolder ?? './output/images';
  }

  get mongoHost(): string {
    return this.secrets.mongodb?.host ?? 'localhost';
  }

  get mongoPort(): number {
    return this.secrets.mongodb?.port ?? 27017;
  }

  get mongoDatabase(): string {
    return this.secrets.mongodb?.database ?? 'idealistaScraper';
  }

  get mongoAuthSource(): string {
    return this.secrets.mongodb?.authSource ?? this.mongoDatabase;
  }

  get mongoUser(): string {
    return this.secrets.mongodb?.user ?? '';
  }

  get mongoPassword(): string {
    return this.secrets.mongodb?.password ?? '';
  }

  get mongoConnectionUri(): string {
    const encodedUser = encodeURIComponent(this.mongoUser);
    const encodedPassword = encodeURIComponent(this.mongoPassword);
    const encodedAuthSource = encodeURIComponent(this.mongoAuthSource);
    return `mongodb://${encodedUser}:${encodedPassword}@${this.mongoHost}:${this.mongoPort}/${this.mongoDatabase}?authSource=${encodedAuthSource}`;
  }

  get googleClientId(): string {
    return (this.secrets.auth?.google?.clientId ?? '').trim();
  }

  get googleClientSecret(): string {
    return (this.secrets.auth?.google?.clientSecret ?? '').trim();
  }

  get googleRedirectUri(): string {
    return (this.secrets.auth?.google?.redirectUri ?? '').trim();
  }

  get googleScope(): string {
    const scope = (this.secrets.auth?.google?.scope ?? '').trim();
    return scope || 'openid email profile';
  }

  get googlePrompt(): string {
    const prompt = (this.secrets.auth?.google?.prompt ?? '').trim();
    return prompt || 'select_account';
  }

  get authFrontendBaseUrl(): string {
    const configured = (this.secrets.auth?.frontendBaseUrl ?? '').trim();
    return configured || 'http://localhost:4200';
  }

  get authSessionCookieName(): string {
    const configured = (this.secrets.auth?.session?.cookieName ?? '').trim();
    return configured || 'pf_session';
  }

  get authSessionTtlSeconds(): number {
    const configured = this.secrets.auth?.session?.ttlSeconds;
    if (typeof configured !== 'number' || !Number.isFinite(configured) || configured <= 0) {
      return 60 * 60 * 24 * 7;
    }
    return Math.floor(configured);
  }

  get authSessionSecureCookie(): boolean {
    return this.secrets.auth?.session?.secureCookie ?? false;
  }
}
