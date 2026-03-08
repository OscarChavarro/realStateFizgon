type RabbitConfigMockOptions = {
  host?: string;
  port?: number;
  vhost?: string;
  queue?: string;
  user?: string;
  password?: string;
};

export class RabbitConfigMock {
  constructor(private readonly options: RabbitConfigMockOptions = {}) {}

  get rabbitMqHost(): string {
    return this.options.host ?? 'localhost';
  }

  get rabbitMqPort(): number {
    return this.options.port ?? 5672;
  }

  get rabbitMqVhost(): string {
    return this.options.vhost ?? 'dev';
  }

  get rabbitMqQueue(): string {
    return this.options.queue ?? 'property-listing-urls';
  }

  get rabbitMqUser(): string {
    return this.options.user ?? 'guest';
  }

  get rabbitMqPassword(): string {
    return this.options.password ?? 'guest';
  }
}
