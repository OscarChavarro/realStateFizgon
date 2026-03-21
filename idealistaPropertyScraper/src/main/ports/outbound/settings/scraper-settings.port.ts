import type { ScraperState } from 'domain/states/scraper-state';
import type { FilterId } from 'domain/filters/filter-id';

export type ScraperFilterDefinition = {
  plainOptions: string[];
  minOptions: string[];
  maxOptions: string[];
  selectedPlainOptions: string[];
  selectedMin: string | null;
  selectedMax: string | null;
};

export interface ScraperSettingsPort {
  readonly scraperHomeUrl: string;
  readonly mainSearchArea: string;
  readonly mainPageExpressionTimeoutMs: number;
  readonly mainPageExpressionPollIntervalMs: number;
  readonly mainPageSearchClickWaitMs: number;
  readonly mainPageFirstLoadDeviceVerificationWaitMs: number;
  readonly filterStateClickWaitMs: number;
  readonly filterListingLoadingTimeoutMs: number;
  readonly filterListingLoadingPollIntervalMs: number;
  readonly paginationClickWaitMs: number;
  readonly imageDownloadFolder: string;
  readonly propertyDetailPageScrollIntervalMs: number;
  readonly propertyDetailPageScrollEvents: number;
  readonly propertyDetailPageImagesLoadWaitMs: number;
  readonly propertyDetailPageMorePhotosClickWaitMs: number;
  readonly propertyDetailPagePreMediaExpansionWaitMs: number;
  readonly cookieApprovalDialogWaitMs: number;
  readonly apiHttpPort: number;
  readonly endpointsUser: string;
  readonly endpointsPassword: string;
  readonly reScrapeIntervalMs: number;
  readonly initialScraperState: ScraperState;
  getFilterDefinitionById(filterId: FilterId): ScraperFilterDefinition | undefined;
}
