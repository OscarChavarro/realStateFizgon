import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

type Environment = {
  chrome: {
    binary: string;
    path: string;
    cdpPort: number;
  };
  rabbitmq: {
    host: string;
    port: number;
  };
  timeouts: {
    chrome: {
      cdpreadytimeout: number;
      cdprequesttimeout: number;
      cdppollinterval: number;
    };
    consumer: {
      delayafterurlms: number;
    };
    propertydetailpage: {
      scrollintervalms: number;
      scrollevents: number;
    };
  };
};

type Secrets = {
  rabbitmq?: {
    host?: string;
    port?: number;
    vhost?: string;
    queue?: string;
    user?: string;
    password?: string;
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

  get chromeBinary(): string {
    return this.environment.chrome.binary;
  }

  get chromePath(): string {
    return this.environment.chrome.path;
  }

  get chromeCdpPort(): number {
    return this.environment.chrome.cdpPort ?? 9223;
  }

  get chromeCdpReadyTimeoutMs(): number {
    return this.environment.timeouts?.chrome?.cdpreadytimeout ?? 60000;
  }

  get chromeCdpRequestTimeoutMs(): number {
    return this.environment.timeouts?.chrome?.cdprequesttimeout ?? 2000;
  }

  get chromeCdpPollIntervalMs(): number {
    return this.environment.timeouts?.chrome?.cdppollinterval ?? 500;
  }

  get delayAfterUrlMs(): number {
    return this.environment.timeouts?.consumer?.delayafterurlms ?? 5000;
  }

  get propertyDetailPageScrollIntervalMs(): number {
    return this.environment.timeouts?.propertydetailpage?.scrollintervalms ?? 200;
  }

  get propertyDetailPageScrollEvents(): number {
    return this.environment.timeouts?.propertydetailpage?.scrollevents ?? 10;
  }

  get rabbitMqHost(): string {
    return this.secrets.rabbitmq?.host ?? this.environment.rabbitmq?.host ?? 'localhost';
  }

  get rabbitMqPort(): number {
    return this.secrets.rabbitmq?.port ?? this.environment.rabbitmq?.port ?? 5672;
  }

  get rabbitMqVhost(): string {
    return this.secrets.rabbitmq?.vhost ?? 'dev';
  }

  get rabbitMqQueue(): string {
    return this.secrets.rabbitmq?.queue ?? 'property-listing-urls';
  }

  get rabbitMqUser(): string {
    return this.secrets.rabbitmq?.user ?? '';
  }

  get rabbitMqPassword(): string {
    return this.secrets.rabbitmq?.password ?? '';
  }
}
