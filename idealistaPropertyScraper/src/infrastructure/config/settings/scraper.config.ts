import { Injectable, Logger } from '@nestjs/common';
import { ScraperState } from 'src/domain/states/scraper-state.enum';
import { FilterDefinition } from 'src/infrastructure/config/settings/filter-definition.type';
import { ConfigurationSourceService } from 'src/infrastructure/config/settings/configuration-source.service';

@Injectable()
export class ScraperConfig {
  private readonly logger = new Logger(ScraperConfig.name);

  constructor(private readonly configurationSourceService: ConfigurationSourceService) {}

  get scraperHomeUrl(): string {
    return this.configurationSourceService.environment.scraper.home.url;
  }

  get mainSearchArea(): string {
    return this.configurationSourceService.environment.scraper.home.mainSearchArea;
  }

  get mainPageExpressionTimeoutMs(): number {
    return this.configurationSourceService.environment.timeouts?.mainpage?.expressiontimeout ?? 30000;
  }

  get mainPageExpressionPollIntervalMs(): number {
    return this.configurationSourceService.environment.timeouts?.mainpage?.expressionpollinterval ?? 200;
  }

  get mainPageSearchClickWaitMs(): number {
    return Math.max(0, this.configurationSourceService.environment.timeouts?.mainpage?.searchclickwaitms ?? 1000);
  }

  get mainPageFirstLoadDeviceVerificationWaitMs(): number {
    return Math.max(0, this.configurationSourceService.environment.timeouts?.mainpage?.firstloaddeviceverificationwaitms ?? 30000);
  }

  get filterStateClickWaitMs(): number {
    return this.configurationSourceService.environment.timeouts?.filter?.stateclickwait ?? 2000;
  }

  get filterListingLoadingTimeoutMs(): number {
    return this.configurationSourceService.environment.timeouts?.filter?.listingloadingtimeout ?? 10000;
  }

  get filterListingLoadingPollIntervalMs(): number {
    return this.configurationSourceService.environment.timeouts?.filter?.listingloadingpollinterval ?? 200;
  }

  get paginationClickWaitMs(): number {
    return this.configurationSourceService.environment.timeouts?.pagination?.clickwait ?? 1000;
  }

  get imageDownloadFolder(): string {
    return this.configurationSourceService.environment.images?.downloadFolder ?? './output/images';
  }

  get propertyDetailPageScrollIntervalMs(): number {
    return this.configurationSourceService.environment.timeouts?.propertydetailpage?.scrollintervalms ?? 200;
  }

  get propertyDetailPageScrollEvents(): number {
    return this.configurationSourceService.environment.timeouts?.propertydetailpage?.scrollevents ?? 10;
  }

  get propertyDetailPageImagesLoadWaitMs(): number {
    return this.configurationSourceService.environment.timeouts?.propertydetailpage?.imagesloadwaitms ?? 2000;
  }

  get propertyDetailPageMorePhotosClickWaitMs(): number {
    return this.configurationSourceService.environment.timeouts?.propertydetailpage?.morephotosclickwaitms ?? 400;
  }

  get propertyDetailPagePreMediaExpansionWaitMs(): number {
    return this.configurationSourceService.environment.timeouts?.propertydetailpage?.premediaexpansionwaitms ?? 1000;
  }

  get cookieApprovalDialogWaitMs(): number {
    return this.configurationSourceService.environment.timeouts?.propertydetailpage?.cookieapprovaldialogwaitms
      ?? this.configurationSourceService.environment.timeouts?.propertydetailpage?.cookieaprovaldialogwaitms
      ?? 2000;
  }

  get apiHttpPort(): number {
    return Math.max(1, this.configurationSourceService.environment.api?.httpPort ?? 3000);
  }

  get initialScraperState(): ScraperState {
    const raw = (this.configurationSourceService.environment.initialState ?? '').toString().trim().toUpperCase();
    if (raw === ScraperState.SCRAPING_FOR_NEW_PROPERTIES) {
      return ScraperState.SCRAPING_FOR_NEW_PROPERTIES;
    }
    if (raw === ScraperState.UPDATING_PROPERTIES) {
      return ScraperState.UPDATING_PROPERTIES;
    }
    if (raw && raw !== ScraperState.IDLE) {
      this.logger.warn(`Unknown initialState "${raw}". Falling back to ${ScraperState.IDLE}.`);
    }
    return ScraperState.IDLE;
  }

  getFilterDefinitionByName(filterName: string): FilterDefinition | undefined {
    return this.configurationSourceService.getFilterDefinitionByName(filterName);
  }
}
