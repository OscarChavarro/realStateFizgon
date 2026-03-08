import { ScraperState } from 'src/domain/states/scraper-state.enum';

type ScraperConfigMockOptions = {
  initialScraperState?: ScraperState;
  endpointsUser?: string;
  endpointsPassword?: string;
};

export class ScraperConfigMock {
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
}
