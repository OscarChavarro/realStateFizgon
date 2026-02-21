import { Injectable } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Environment = {
  chrome: {
    binary: string;
    path: string;
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
    };
    filter: {
      stateclickwait: number;
    };
  };
  scraper: {
    home: {
      url: string;
      mainSearchArea: string;
    };
  };
};

@Injectable()
export class Configuration {
  private readonly environment: Environment;

  constructor() {
    const raw = readFileSync(join(process.cwd(), 'environment.json'), 'utf-8');
    this.environment = JSON.parse(raw) as Environment;
  }

  get chromeBinary(): string {
    return this.environment.chrome.binary;
  }

  get chromePath(): string {
    return this.environment.chrome.path;
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

  get filterStateClickWaitMs(): number {
    return this.environment.timeouts?.filter?.stateclickwait ?? 2000;
  }
}
