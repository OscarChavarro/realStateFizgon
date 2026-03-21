import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { FILTER_IDS, type FilterId } from 'domain/filters/filter-id';
import { FilterDefinition } from 'infrastructure/config/settings/filter-definition.type';
import {
  Environment,
  EnvironmentSchema,
  Secrets,
  SecretsSchema
} from 'infrastructure/config/validation/configuration.schema';
import { EnvironmentFilterDefinitionValue } from 'infrastructure/config/validation/scraper.schema';
import { toErrorMessage } from 'infrastructure/error-message';

const FILTER_ID_BY_FILTER_LABEL: Record<string, FilterId> = {
  'Tipo de inmueble': FILTER_IDS.PROPERTY_TYPE,
  'Precio': FILTER_IDS.PRICE,
  'Tipo de alquiler': FILTER_IDS.RENTAL_TYPE,
  'Tamaño': FILTER_IDS.SIZE,
  'Tipo de vivienda': FILTER_IDS.HOUSING_TYPE,
  'Otras denominaciones': FILTER_IDS.OTHER_DENOMINATIONS,
  Equipamiento: FILTER_IDS.EQUIPMENT,
  Habitaciones: FILTER_IDS.ROOMS,
  'Baños': FILTER_IDS.BATHROOMS,
  Estado: FILTER_IDS.CONDITION,
  'Características': FILTER_IDS.FEATURES,
  Planta: FILTER_IDS.FLOOR,
  'Eficiencia Energética': FILTER_IDS.ENERGY_EFFICIENCY,
  Multimedia: FILTER_IDS.MULTIMEDIA,
  'Tipo de anuncio': FILTER_IDS.LISTING_TYPE,
  'Fecha de publicación': FILTER_IDS.PUBLICATION_DATE
};

@Injectable()
export class ConfigurationSourceService {
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

  getFilterDefinitionById(filterId: FilterId): FilterDefinition | undefined {
    return this.filterDefinitionsByKey[filterId];
  }

  getFilterDefinitionByLabel(filterLabel: string): FilterDefinition | undefined {
    const filterId = FILTER_ID_BY_FILTER_LABEL[filterLabel];
    if (!filterId) {
      return undefined;
    }

    return this.getFilterDefinitionById(filterId);
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

      const normalizedDefinitionKey = this.resolveFilterDefinitionKey(definitionKey);
      accumulator[normalizedDefinitionKey] = this.sanitizeFilterDefinition(definition);
    }

    return accumulator;
  }

  private resolveFilterDefinitionKey(definitionKey: string): string {
    return FILTER_ID_BY_FILTER_LABEL[definitionKey] ?? definitionKey;
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
