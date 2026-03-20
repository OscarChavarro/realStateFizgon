export interface RabbitSettingsPort {
  readonly rabbitMqHost: string;
  readonly rabbitMqPort: number;
  readonly rabbitMqVhost: string;
  readonly rabbitMqQueue: string;
  readonly rabbitMqUser: string;
  readonly rabbitMqPassword: string;
}
