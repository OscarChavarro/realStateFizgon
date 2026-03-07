import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ScraperState } from 'src/domain/states/scraper-state.enum';
import { FilterDefinition } from 'src/infrastructure/config/filter-definition.type';

type Environment = {
  initialState?: string;
  api?: {
    httpPort?: number;
  };
  chrome: {
    binary: string;
    chromiumOptions?: string[];
  };
  rabbitmq: {
    host: string;
    port: number;
  };
  images?: {
    downloadFolder?: string;
  };
  timeouts: {
    chrome: {
      cdpreadytimeout: number;
      cdprequesttimeout: number;
      cdppollinterval: number;
      originerrorreloadwait: number;
      expressiontimeout: number;
      expressionpollinterval: number;
      browserlaunchretrywaitms?: number;
    };
    mainpage: {
      expressiontimeout: number;
      expressionpollinterval: number;
      firstloaddeviceverificationwaitms?: number;
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
    propertydetailpage?: {
      scrollintervalms?: number;
      scrollevents?: number;
      imagesloadwaitms?: number;
      morephotosclickwaitms?: number;
      premediaexpansionwaitms?: number;
      cookieapprovaldialogwaitms?: number;
      // Deprecated typo kept for backward compatibility with older environment.json files.
      cookieaprovaldialogwaitms?: number;
    };
  };
  scraper: {
    home: {
      url: string;
      mainSearchArea: string;
    };
  };
  filters?: {
    definitions?: Array<Record<string, {
      plainOptions?: unknown[];
      minOptions?: unknown[];
      maxOptions?: unknown[];
      selectedPlainOptions?: unknown[];
      selectedMin?: unknown;
      selectedMax?: unknown;
    }>>;
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
  mongodb?: {
    host?: string;
    port?: number;
    database?: string;
    authSource?: string;
    user?: string;
    password?: string;
  };
  proxy?: {
    enable?: boolean;
    host?: string;
    port?: string | number;
    user?: string;
    password?: string;
  };
  chrome?: {
    path?: string;
    userAgent?: string;
    acceptLanguage?: string;
    extraHeaders?: Record<string, string>;
  };
  geolocation?: {
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    allowlist?: string[];
  };
};

const FILTER_DEFINITION_KEY_BY_FILTER_NAME: Record<string, string> = {
  'Tipo de inmueble': 'propertyType',
  'Precio': 'price',
  'Tipo de alquiler': 'rentalType',
  'Tamaño': 'size',
  'Tipo de vivienda': 'housingType',
  'Otras denominaciones': 'otherDenominations',
  Equipamiento: 'equipment',
  Habitaciones: 'rooms',
  'Baños': 'bathrooms',
  Estado: 'condition',
  'Características': 'features',
  Planta: 'floor',
  'Eficiencia Energética': 'energyEfficiency',
  Multimedia: 'multimedia',
  'Tipo de anuncio': 'listingType',
  'Fecha de publicación': 'publicationDate'
};

@Injectable()
export class Configuration {
  private readonly environment: Environment;
  private readonly secrets: Secrets;
  private readonly filterDefinitionsByKey: Record<string, FilterDefinition>;
  private readonly logger = new Logger(Configuration.name);

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
    this.filterDefinitionsByKey = this.loadFilterDefinitionsByKey();
  }

  get chromeBinary(): string {
    return this.environment.chrome.binary;
  }

  get chromePath(): string {
    const path = (this.secrets.chrome?.path ?? '').trim();
    return path || '/tmp/googleChromeIdealistaScraper';
  }

  get chromeUserAgent(): string {
    return (this.secrets.chrome?.userAgent ?? '').trim();
  }

  get chromeAcceptLanguage(): string {
    return (this.secrets.chrome?.acceptLanguage ?? '').trim();
  }

  get chromeExtraHeaders(): Record<string, string> {
    const extra = this.secrets.chrome?.extraHeaders;
    if (!extra || typeof extra !== 'object') {
      return {};
    }

    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(extra)) {
      const headerKey = (key ?? '').toString().trim();
      const headerValue = (value ?? '').toString().trim();
      if (!headerKey || !headerValue) {
        continue;
      }
      sanitized[headerKey] = headerValue;
    }
    return sanitized;
  }

  get chromiumOptions(): string[] {
    const baseOptions = this.environment.chrome.chromiumOptions ?? [];
    return [...baseOptions, ...this.chromiumProxyOptions(), ...this.chromiumUserAgentOptions()];
  }

  private chromiumProxyOptions(): string[] {
    if (!this.proxyEnabled) {
      return [];
    }

    const host = (this.secrets.proxy?.host ?? '').trim();
    const rawPort = this.secrets.proxy?.port;
    const port = typeof rawPort === 'number'
      ? String(rawPort)
      : (rawPort ?? '').trim();

    if (!host || !port) {
      return [];
    }

    return [`--proxy-server=http://${host}:${port}`];
  }

  private chromiumUserAgentOptions(): string[] {
    const userAgent = this.chromeUserAgent;
    if (!userAgent) {
      return [];
    }

    return [`--user-agent=${userAgent}`];
  }

  get proxyEnabled(): boolean {
    return this.secrets.proxy?.enable ?? false;
  }

  get proxyHost(): string {
    return (this.secrets.proxy?.host ?? '').trim();
  }

  get proxyPort(): number {
    const rawPort = this.secrets.proxy?.port;
    const port = typeof rawPort === 'number' ? rawPort : Number((rawPort ?? '').trim());
    return Number.isFinite(port) ? port : 0;
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

  get geolocationOverride(): { latitude: number; longitude: number; accuracy: number } | undefined {
    const geolocation = this.secrets.geolocation;
    if (!geolocation) {
      return undefined;
    }

    const latitude = Number(geolocation.latitude);
    const longitude = Number(geolocation.longitude);
    const accuracy = Number.isFinite(geolocation.accuracy) ? Number(geolocation.accuracy) : 50;

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      this.logger.warn('Invalid geolocation configuration. Skipping geolocation override.');
      return undefined;
    }

    return { latitude, longitude, accuracy };
  }

  get geolocationAllowlist(): string[] {
    const allowlist = this.secrets.geolocation?.allowlist;
    if (!Array.isArray(allowlist)) {
      return [];
    }

    return allowlist
      .map((entry) => (entry ?? '').toString().trim())
      .filter((entry) => entry.length > 0);
  }

  getFilterDefinitionByName(filterName: string): FilterDefinition | undefined {
    const definitionKey = FILTER_DEFINITION_KEY_BY_FILTER_NAME[filterName];
    if (!definitionKey) {
      return undefined;
    }

    return this.filterDefinitionsByKey[definitionKey];
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

  get chromeBrowserLaunchRetryWaitMs(): number {
    return Math.max(0, this.environment.timeouts?.chrome?.browserlaunchretrywaitms ?? 3600000);
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

  get mainPageFirstLoadDeviceVerificationWaitMs(): number {
    return Math.max(0, this.environment.timeouts?.mainpage?.firstloaddeviceverificationwaitms ?? 30000);
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

  get imageDownloadFolder(): string {
    return this.environment.images?.downloadFolder ?? './output/images';
  }

  get propertyDetailPageScrollIntervalMs(): number {
    return this.environment.timeouts?.propertydetailpage?.scrollintervalms ?? 200;
  }

  get propertyDetailPageScrollEvents(): number {
    return this.environment.timeouts?.propertydetailpage?.scrollevents ?? 10;
  }

  get propertyDetailPageImagesLoadWaitMs(): number {
    return this.environment.timeouts?.propertydetailpage?.imagesloadwaitms ?? 2000;
  }

  get propertyDetailPageMorePhotosClickWaitMs(): number {
    return this.environment.timeouts?.propertydetailpage?.morephotosclickwaitms ?? 400;
  }

  get propertyDetailPagePreMediaExpansionWaitMs(): number {
    return this.environment.timeouts?.propertydetailpage?.premediaexpansionwaitms ?? 1000;
  }

  get cookieApprovalDialogWaitMs(): number {
    return this.environment.timeouts?.propertydetailpage?.cookieapprovaldialogwaitms
      ?? this.environment.timeouts?.propertydetailpage?.cookieaprovaldialogwaitms
      ?? 2000;
  }

  get rabbitMqUser(): string {
    return this.secrets.rabbitmq?.user ?? '';
  }

  get rabbitMqPassword(): string {
    return this.secrets.rabbitmq?.password ?? '';
  }

  get mongoHost(): string {
    return this.secrets.mongodb?.host ?? 'localhost';
  }

  get mongoPort(): number {
    return this.secrets.mongodb?.port ?? 27017;
  }

  get mongoDatabase(): string {
    return this.secrets.mongodb?.database ?? 'idealistaScraper';
  }

  get mongoAuthSource(): string {
    return this.secrets.mongodb?.authSource ?? this.mongoDatabase;
  }

  get mongoUser(): string {
    return this.secrets.mongodb?.user ?? '';
  }

  get mongoPassword(): string {
    return this.secrets.mongodb?.password ?? '';
  }

  get mongoConnectionUri(): string {
    const encodedUser = encodeURIComponent(this.mongoUser);
    const encodedPassword = encodeURIComponent(this.mongoPassword);
    const encodedAuthSource = encodeURIComponent(this.mongoAuthSource);
    return `mongodb://${encodedUser}:${encodedPassword}@${this.mongoHost}:${this.mongoPort}/${this.mongoDatabase}?authSource=${encodedAuthSource}`;
  }

  get apiHttpPort(): number {
    return Math.max(1, this.environment.api?.httpPort ?? 3000);
  }

  get initialScraperState(): ScraperState {
    const raw = (this.environment.initialState ?? '').toString().trim().toUpperCase();
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

  private loadFilterDefinitionsByKey(): Record<string, FilterDefinition> {
    const definitions = this.environment.filters?.definitions ?? [];
    const accumulator: Record<string, FilterDefinition> = {};

    for (const entry of definitions) {
      const definitionKey = Object.keys(entry)[0];
      if (!definitionKey) {
        continue;
      }

      const definition = entry[definitionKey];
      if (!definition || typeof definition !== 'object') {
        continue;
      }

      accumulator[definitionKey] = this.sanitizeFilterDefinition(definition);
    }

    return accumulator;
  }

  private sanitizeFilterDefinition(definition: {
    plainOptions?: unknown[];
    minOptions?: unknown[];
    maxOptions?: unknown[];
    selectedPlainOptions?: unknown[];
    selectedMin?: unknown;
    selectedMax?: unknown;
  }): FilterDefinition {
    return {
      plainOptions: this.normalizeStringArray(definition.plainOptions),
      minOptions: this.normalizeStringArray(definition.minOptions),
      maxOptions: this.normalizeStringArray(definition.maxOptions),
      selectedPlainOptions: this.normalizeStringArray(definition.selectedPlainOptions),
      selectedMin: typeof definition.selectedMin === 'string' ? definition.selectedMin : null,
      selectedMax: typeof definition.selectedMax === 'string' ? definition.selectedMax : null
    };
  }

  private normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((entry): entry is string => typeof entry === 'string');
  }
}
