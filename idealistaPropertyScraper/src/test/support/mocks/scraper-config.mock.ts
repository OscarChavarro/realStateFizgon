import { ScraperState } from 'domain/states/scraper-state';
import type { EndpointsAuthSettingsPort } from 'ports/outbound/settings/endpoints-auth-settings.port';

type ScraperConfigMockOptions = {
  initialScraperState?: ScraperState;
  endpointsUser?: string;
  endpointsPassword?: string;
  reScrapeIntervalMs?: number;
};

export class ScraperConfigMock implements EndpointsAuthSettingsPort {
  constructor(private readonly options: ScraperConfigMockOptions = {}) {}

  get initialScraperState(): ScraperState {
    return this.options.initialScraperState ?? ScraperState.IDLE;
  }

  get endpointsUser(): string {
    return this.options.endpointsUser ?? 'user';
  }

  get endpointsPassword(): string {
    return this.options.endpointsPassword ?? 'password';
  }

  get reScrapeIntervalMs(): number {
    return this.options.reScrapeIntervalMs ?? 900000;
  }
}
