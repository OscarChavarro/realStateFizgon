import { Injectable } from '@nestjs/common';
import { ConfigurationSourceService } from 'infrastructure/config/settings/configuration-source.service';
import type { MongoSettingsPort } from 'ports/outbound/settings/mongo-settings.port';

@Injectable()
export class MongoConfig implements MongoSettingsPort {
  constructor(private readonly configurationSourceService: ConfigurationSourceService) {}

  get mongoHost(): string {
    return this.configurationSourceService.secrets.mongodb?.host ?? 'localhost';
  }

  get mongoPort(): number {
    return this.configurationSourceService.secrets.mongodb?.port ?? 27017;
  }

  get mongoDatabase(): string {
    return this.configurationSourceService.secrets.mongodb?.database ?? 'idealistaScraper';
  }

  get mongoAuthSource(): string {
    return this.configurationSourceService.secrets.mongodb?.authSource ?? this.mongoDatabase;
  }

  get mongoUser(): string {
    return this.configurationSourceService.secrets.mongodb?.user ?? '';
  }

  get mongoPassword(): string {
    return this.configurationSourceService.secrets.mongodb?.password ?? '';
  }

  get mongoConnectionUri(): string {
    const encodedUser = encodeURIComponent(this.mongoUser);
    const encodedPassword = encodeURIComponent(this.mongoPassword);
    const encodedAuthSource = encodeURIComponent(this.mongoAuthSource);
    return `mongodb://${encodedUser}:${encodedPassword}@${this.mongoHost}:${this.mongoPort}/${this.mongoDatabase}?authSource=${encodedAuthSource}`;
  }
}
