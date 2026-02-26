import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

type Environment = {
  chrome: {
    binary: string;
    path: string;
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
      originerrorreloadwait: number;
      expressiontimeout: number;
      expressionpollinterval: number;
    };
    mainpage: {
      expressiontimeout: number;
      expressionpollinterval: number;
      searchclickwaitms?: number;
    };
    filter: {
      stateclickwait: number;
      listingloadingtimeout: number;
      listingloadingpollinterval: number;
    };
    pagination: {
      clickwait: number;
    };
  };
  scraper: {
    home: {
      url: string;
      mainSearchArea: string;
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

  get scraperHomeUrl(): string {
    return this.environment.scraper.home.url;
  }

  get mainSearchArea(): string {
    return this.environment.scraper.home.mainSearchArea;
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

  get chromeOriginErrorReloadWaitMs(): number {
    return this.environment.timeouts?.chrome?.originerrorreloadwait ?? 1000;
  }

  get chromeExpressionTimeoutMs(): number {
    return this.environment.timeouts?.chrome?.expressiontimeout ?? 30000;
  }

  get chromeExpressionPollIntervalMs(): number {
    return this.environment.timeouts?.chrome?.expressionpollinterval ?? 200;
  }

  get mainPageExpressionTimeoutMs(): number {
    return this.environment.timeouts?.mainpage?.expressiontimeout ?? 30000;
  }

  get mainPageExpressionPollIntervalMs(): number {
    return this.environment.timeouts?.mainpage?.expressionpollinterval ?? 200;
  }

  get mainPageSearchClickWaitMs(): number {
    return Math.max(0, this.environment.timeouts?.mainpage?.searchclickwaitms ?? 1000);
  }

  get filterStateClickWaitMs(): number {
    return this.environment.timeouts?.filter?.stateclickwait ?? 2000;
  }

  get filterListingLoadingTimeoutMs(): number {
    return this.environment.timeouts?.filter?.listingloadingtimeout ?? 10000;
  }

  get filterListingLoadingPollIntervalMs(): number {
    return this.environment.timeouts?.filter?.listingloadingpollinterval ?? 200;
  }

  get paginationClickWaitMs(): number {
    return this.environment.timeouts?.pagination?.clickwait ?? 1000;
  }

  get rabbitMqUser(): string {
    return this.secrets.rabbitmq?.user ?? '';
  }

  get rabbitMqPassword(): string {
    return this.secrets.rabbitmq?.password ?? '';
  }
}
