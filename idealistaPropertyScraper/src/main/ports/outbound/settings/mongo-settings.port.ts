export interface MongoSettingsPort {
  readonly mongoHost: string;
  readonly mongoPort: number;
  readonly mongoDatabase: string;
  readonly mongoAuthSource: string;
  readonly mongoUser: string;
  readonly mongoPassword: string;
  readonly mongoConnectionUri: string;
}
