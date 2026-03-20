import type { MongoSettingsPort } from 'ports/outbound/settings/mongo-settings.port';

type MongoConfigMockOptions = {
  connectionUri?: string;
  host?: string;
  port?: number;
  database?: string;
  authSource?: string;
  user?: string;
  password?: string;
};

export class MongoConfigMock implements MongoSettingsPort {
  constructor(private readonly options: MongoConfigMockOptions = {}) {}

  get mongoHost(): string {
    return this.options.host ?? 'localhost';
  }

  get mongoPort(): number {
    return this.options.port ?? 27017;
  }

  get mongoConnectionUri(): string {
    return this.options.connectionUri ?? 'mongodb://user:pass@localhost:27017/idealista?authSource=admin';
  }

  get mongoDatabase(): string {
    return this.options.database ?? 'idealista';
  }

  get mongoAuthSource(): string {
    return this.options.authSource ?? 'admin';
  }

  get mongoUser(): string {
    return this.options.user ?? 'user';
  }

  get mongoPassword(): string {
    return this.options.password ?? 'pass';
  }
}
