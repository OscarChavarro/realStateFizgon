import { FilterDefinition } from 'src/infrastructure/config/settings/filter-definition.type';

type FilterDefinitionByName = Record<string, FilterDefinition | undefined>;
type SettingsPayload = Record<string, unknown>;

export class ConfigurationSourceServiceMock {
  constructor(
    public readonly environment: SettingsPayload = {},
    public readonly secrets: SettingsPayload = {},
    private readonly filterDefinitionsByName: FilterDefinitionByName = {}
  ) {}

  getFilterDefinitionByName(filterName: string): FilterDefinition | undefined {
    return this.filterDefinitionsByName[filterName];
  }
}
