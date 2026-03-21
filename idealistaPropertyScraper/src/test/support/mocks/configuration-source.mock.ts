import { FilterDefinition } from 'infrastructure/config/settings/filter-definition.type';
import type { FilterId } from 'domain/filters/filter-id';

type FilterDefinitionById = Record<string, FilterDefinition | undefined>;
type SettingsPayload = Record<string, unknown>;

export class ConfigurationSourceServiceMock {
  constructor(
    public readonly environment: SettingsPayload = {},
    public readonly secrets: SettingsPayload = {},
    private readonly filterDefinitionsById: FilterDefinitionById = {}
  ) {}

  getFilterDefinitionById(filterId: FilterId): FilterDefinition | undefined {
    return this.filterDefinitionsById[filterId];
  }
}
