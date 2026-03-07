import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { FilterDefinition } from 'src/infrastructure/config/settings/filter-definition.type';
import {
  Environment,
  EnvironmentSchema,
  Secrets,
  SecretsSchema
} from 'src/infrastructure/config/validation/configuration.schema';
import { EnvironmentFilterDefinitionValue } from 'src/infrastructure/config/validation/scraper.schema';
import { toErrorMessage } from 'src/infrastructure/error-message';

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
