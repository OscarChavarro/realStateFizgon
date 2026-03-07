import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { FilterDefinition } from 'src/infrastructure/config/filter-definition.type';
import { toErrorMessage } from 'src/infrastructure/error-message';

const FilterDefinitionValueSchema = z.object({
  plainOptions: z.array(z.string()).optional(),
  minOptions: z.array(z.string()).optional(),
  maxOptions: z.array(z.string()).optional(),
  selectedPlainOptions: z.array(z.string()).optional(),
  selectedMin: z.union([z.string(), z.null()]).optional(),
  selectedMax: z.union([z.string(), z.null()]).optional()
}).strict();

const FilterDefinitionEntrySchema = z.record(z.string(), FilterDefinitionValueSchema).refine(
  (entry) => Object.keys(entry).length === 1,
  { message: 'Each filters.definitions entry must contain exactly one key.' }
);

const EnvironmentSchema = z.object({
  initialState: z.string().optional(),
  api: z.object({
    httpPort: z.number().int().positive().optional()
  }).optional(),
  chrome: z.object({
    binary: z.string().min(1, 'chrome.binary is required.'),
    chromiumOptions: z.array(z.string()).optional()
  }).strict(),
  rabbitmq: z.object({
    host: z.string().min(1, 'rabbitmq.host is required.'),
    port: z.number().int().positive('rabbitmq.port must be a positive integer.')
  }).strict(),
  images: z.object({
    downloadFolder: z.string().min(1).optional()
  }).strict().optional(),
  timeouts: z.object({
    chrome: z.object({
      cdpreadytimeout: z.number().int().nonnegative(),
      cdprequesttimeout: z.number().int().nonnegative(),
      cdppollinterval: z.number().int().nonnegative(),
      originerrorreloadwait: z.number().int().nonnegative(),
      expressiontimeout: z.number().int().nonnegative(),
      expressionpollinterval: z.number().int().nonnegative(),
      browserlaunchretrywaitms: z.number().int().nonnegative().optional()
    }).strict(),
    mainpage: z.object({
      expressiontimeout: z.number().int().nonnegative(),
      expressionpollinterval: z.number().int().nonnegative(),
      firstloaddeviceverificationwaitms: z.number().int().nonnegative().optional(),
      searchclickwaitms: z.number().int().nonnegative().optional()
    }).strict(),
    filter: z.object({
      stateclickwait: z.number().int().nonnegative(),
      listingloadingtimeout: z.number().int().nonnegative(),
      listingloadingpollinterval: z.number().int().nonnegative()
    }).strict(),
    pagination: z.object({
      clickwait: z.number().int().nonnegative()
    }).strict(),
    propertydetailpage: z.object({
      scrollintervalms: z.number().int().nonnegative().optional(),
      scrollevents: z.number().int().nonnegative().optional(),
      imagesloadwaitms: z.number().int().nonnegative().optional(),
      morephotosclickwaitms: z.number().int().nonnegative().optional(),
      premediaexpansionwaitms: z.number().int().nonnegative().optional(),
      cookieapprovaldialogwaitms: z.number().int().nonnegative().optional(),
      cookieaprovaldialogwaitms: z.number().int().nonnegative().optional()
    }).strict().optional()
  }).strict(),
  scraper: z.object({
    home: z.object({
      url: z.string().url('scraper.home.url must be a valid URL.'),
      mainSearchArea: z.string().min(1, 'scraper.home.mainSearchArea is required.')
    }).strict()
  }).strict(),
  filters: z.object({
    definitions: z.array(FilterDefinitionEntrySchema).optional()
  }).strict().optional()
}).strict();

const SecretsSchema = z.object({
  rabbitmq: z.object({
    host: z.string().optional(),
    port: z.number().int().positive().optional(),
    vhost: z.string().optional(),
    queue: z.string().optional(),
    user: z.string().optional(),
    password: z.string().optional()
  }).strict().optional(),
  mongodb: z.object({
    host: z.string().optional(),
    port: z.number().int().positive().optional(),
    database: z.string().optional(),
    authSource: z.string().optional(),
    user: z.string().optional(),
    password: z.string().optional()
  }).strict().optional(),
  proxy: z.object({
    enable: z.boolean().optional(),
    host: z.string().optional(),
    port: z.union([z.string().min(1), z.number().int().positive()]).optional(),
    user: z.string().optional(),
    password: z.string().optional()
  }).strict().optional(),
  chrome: z.object({
    path: z.string().optional(),
    userAgent: z.string().optional(),
    acceptLanguage: z.string().optional(),
    extraHeaders: z.record(z.string(), z.string()).optional()
  }).strict().optional(),
  geolocation: z.object({
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    accuracy: z.number().positive().optional(),
    allowlist: z.array(z.string().url()).optional()
  }).strict().superRefine((value, context) => {
    const hasLatitude = value.latitude !== undefined;
    const hasLongitude = value.longitude !== undefined;

    if (hasLatitude !== hasLongitude) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'geolocation.latitude and geolocation.longitude must be provided together.'
      });
    }
  }).optional()
}).passthrough();

type Environment = z.infer<typeof EnvironmentSchema>;
type Secrets = z.infer<typeof SecretsSchema>;
type EnvironmentFilterDefinitionValue = z.infer<typeof FilterDefinitionValueSchema>;

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
export class ConfigurationSourceService {
  private readonly logger = new Logger(ConfigurationSourceService.name);
  private readonly environmentData: Environment;
  private readonly secretsData: Secrets;
  private readonly filterDefinitionsByKey: Record<string, FilterDefinition>;

  constructor() {
    const environmentPath = join(process.cwd(), 'environment.json');
    const environmentPayload = this.readJsonFile(environmentPath);
    this.environmentData = this.parseWithSchema(EnvironmentSchema, environmentPayload, environmentPath);

    const secretsPath = join(process.cwd(), 'secrets.json');
    if (!existsSync(secretsPath)) {
      throw new Error(
        `Missing file "${secretsPath}". Copy "secrets-example.json" to "secrets.json" and configure credentials.`
      );
    }

    const secretsPayload = this.readJsonFile(secretsPath);
    this.secretsData = this.parseWithSchema(SecretsSchema, secretsPayload, secretsPath);
    this.filterDefinitionsByKey = this.loadFilterDefinitionsByKey();
  }

  get environment(): Environment {
    return this.environmentData;
  }

  get secrets(): Secrets {
    return this.secretsData;
  }

  getFilterDefinitionByName(filterName: string): FilterDefinition | undefined {
    const definitionKey = FILTER_DEFINITION_KEY_BY_FILTER_NAME[filterName];
    if (!definitionKey) {
      return undefined;
    }

    return this.filterDefinitionsByKey[definitionKey];
  }

  private readJsonFile(filePath: string): unknown {
    let raw = '';
    try {
      raw = readFileSync(filePath, 'utf-8');
    } catch (error) {
      const message = toErrorMessage(error);
      throw new Error(`Failed reading configuration file "${filePath}": ${message}`);
    }

    try {
      return JSON.parse(raw) as unknown;
    } catch (error) {
      const message = toErrorMessage(error);
      throw new Error(`Invalid JSON in "${filePath}": ${message}`);
    }
  }

  private parseWithSchema<T>(
    schema: z.ZodType<T>,
    payload: unknown,
    filePath: string
  ): T {
    const result = schema.safeParse(payload);
    if (result.success) {
      return result.data;
    }

    const details = result.error.issues
      .map((issue) => {
        const path = this.formatIssuePath(issue.path);
        return `- ${path}: ${issue.message}`;
      })
      .join('\n');

    throw new Error(`Configuration validation failed for "${filePath}":\n${details}`);
  }

  private formatIssuePath(path: Array<string | number | symbol>): string {
    if (path.length === 0) {
      return '(root)';
    }

    return path
      .map((segment) => {
        if (typeof segment === 'number') {
          return `[${segment}]`;
        }

        if (typeof segment === 'symbol') {
          return segment.toString();
        }

        return segment;
      })
      .join('.');
  }

  private loadFilterDefinitionsByKey(): Record<string, FilterDefinition> {
    const definitions = this.environmentData.filters?.definitions ?? [];
    const accumulator: Record<string, FilterDefinition> = {};

    for (const entry of definitions) {
      const [definitionKey, definition] = Object.entries(entry)[0] ?? [];
      if (!definitionKey || !definition) {
        continue;
      }

      accumulator[definitionKey] = this.sanitizeFilterDefinition(definition);
    }

    return accumulator;
  }

  private sanitizeFilterDefinition(definition: EnvironmentFilterDefinitionValue): FilterDefinition {
    return {
      plainOptions: [...(definition.plainOptions ?? [])],
      minOptions: [...(definition.minOptions ?? [])],
      maxOptions: [...(definition.maxOptions ?? [])],
      selectedPlainOptions: [...(definition.selectedPlainOptions ?? [])],
      selectedMin: definition.selectedMin ?? null,
      selectedMax: definition.selectedMax ?? null
    };
  }
}
