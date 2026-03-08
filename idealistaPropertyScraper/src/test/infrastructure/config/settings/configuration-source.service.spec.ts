import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigurationSourceService } from 'src/infrastructure/config/settings/configuration-source.service';

function buildValidEnvironment(): Record<string, unknown> {
  return {
    chrome: { binary: '/usr/bin/chromium' },
    rabbitmq: { host: 'localhost', port: 5672 },
    timeouts: {
      chrome: {
        cdpreadytimeout: 1000,
        cdprequesttimeout: 1000,
        cdppollinterval: 100,
        originerrorreloadwait: 100,
        expressiontimeout: 1000,
        expressionpollinterval: 100
      },
      mainpage: {
        expressiontimeout: 1000,
        expressionpollinterval: 100
      },
      filter: {
        stateclickwait: 100,
        listingloadingtimeout: 1000,
        listingloadingpollinterval: 100
      },
      pagination: {
        clickwait: 100
      },
      propertydetailpage: {
        scrollintervalms: 100
      }
    },
    scraper: {
      home: {
        url: 'https://www.idealista.com/',
        mainSearchArea: 'Madrid'
      }
    },
    filters: {
      definitions: [
        {
          propertyType: {
            plainOptions: ['Piso'],
            selectedPlainOptions: ['Piso']
          }
        }
      ]
    }
  };
}

function buildValidSecrets(): Record<string, unknown> {
  return {
    endpoints: {
      user: 'user',
      password: 'password'
    }
  };
}

function writeConfigFiles(baseDir: string, environment: unknown, secrets?: unknown): void {
  writeFileSync(join(baseDir, 'environment.json'), JSON.stringify(environment), 'utf-8');
  if (secrets !== undefined) {
    writeFileSync(join(baseDir, 'secrets.json'), JSON.stringify(secrets), 'utf-8');
  }
}

describe('ConfigurationSourceService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('whenSecretsFileIsMissing_constructor_shouldThrowGuidanceError', () => {
    // Arrange
    const tempDir = mkdtempSync(join(tmpdir(), 'cfg-src-'));
    writeConfigFiles(tempDir, buildValidEnvironment());
    jest.spyOn(process, 'cwd').mockReturnValue(tempDir);
    // Action
    const action = () => new ConfigurationSourceService();
    // Assert
    expect(action).toThrow(`Missing file "${join(tempDir, 'secrets.json')}". Copy "secrets-example.json" to "secrets.json" and configure credentials.`);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('whenEnvironmentFileCannotBeRead_constructor_shouldThrowReadError', () => {
    // Arrange
    const tempDir = mkdtempSync(join(tmpdir(), 'cfg-src-'));
    jest.spyOn(process, 'cwd').mockReturnValue(tempDir);
    // Action
    const action = () => new ConfigurationSourceService();
    // Assert
    expect(action).toThrow(`Failed reading configuration file "${join(tempDir, 'environment.json')}"`);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('whenEnvironmentJsonIsInvalid_constructor_shouldThrowInvalidJsonError', () => {
    // Arrange
    const tempDir = mkdtempSync(join(tmpdir(), 'cfg-src-'));
    writeFileSync(join(tempDir, 'environment.json'), '{invalid', 'utf-8');
    writeFileSync(join(tempDir, 'secrets.json'), JSON.stringify(buildValidSecrets()), 'utf-8');
    jest.spyOn(process, 'cwd').mockReturnValue(tempDir);
    // Action
    const action = () => new ConfigurationSourceService();
    // Assert
    expect(action).toThrow(`Invalid JSON in "${join(tempDir, 'environment.json')}"`);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('whenSchemaValidationFails_constructor_shouldThrowValidationDetails', () => {
    // Arrange
    const tempDir = mkdtempSync(join(tmpdir(), 'cfg-src-'));
    const invalidEnvironment = buildValidEnvironment();
    (invalidEnvironment as { chrome: { binary: string } }).chrome.binary = '';
    writeConfigFiles(tempDir, invalidEnvironment, buildValidSecrets());
    jest.spyOn(process, 'cwd').mockReturnValue(tempDir);
    // Action
    const action = () => new ConfigurationSourceService();
    // Assert
    expect(action).toThrow(`Configuration validation failed for "${join(tempDir, 'environment.json')}"`);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('whenMappedFilterDefinitionExists_getFilterDefinitionByName_shouldReturnSanitizedDefinition', () => {
    // Arrange
    const tempDir = mkdtempSync(join(tmpdir(), 'cfg-src-'));
    writeConfigFiles(tempDir, buildValidEnvironment(), buildValidSecrets());
    jest.spyOn(process, 'cwd').mockReturnValue(tempDir);
    const source = new ConfigurationSourceService();
    // Action
    const definition = source.getFilterDefinitionByName('Tipo de inmueble');
    // Assert
    expect(definition).toEqual({
      plainOptions: ['Piso'],
      minOptions: [],
      maxOptions: [],
      selectedPlainOptions: ['Piso'],
      selectedMin: null,
      selectedMax: null
    });
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('whenFilterNameIsUnknown_getFilterDefinitionByName_shouldReturnUndefined', () => {
    // Arrange
    const tempDir = mkdtempSync(join(tmpdir(), 'cfg-src-'));
    writeConfigFiles(tempDir, buildValidEnvironment(), buildValidSecrets());
    jest.spyOn(process, 'cwd').mockReturnValue(tempDir);
    const source = new ConfigurationSourceService();
    // Action
    const definition = source.getFilterDefinitionByName('Filtro inexistente');
    // Assert
    expect(definition).toBeUndefined();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('whenConfigurationIsLoaded_environmentAndSecretsGetters_shouldReturnParsedPayloads', () => {
    // Arrange
    const tempDir = mkdtempSync(join(tmpdir(), 'cfg-src-'));
    writeConfigFiles(tempDir, buildValidEnvironment(), buildValidSecrets());
    jest.spyOn(process, 'cwd').mockReturnValue(tempDir);
    const source = new ConfigurationSourceService();
    // Action
    const payload = {
      environment: source.environment,
      secrets: source.secrets
    };
    // Assert
    expect(payload.environment.scraper.home.url).toBe('https://www.idealista.com/');
    expect(payload.secrets.endpoints.user).toBe('user');
    rmSync(tempDir, { recursive: true, force: true });
  });

  it.each([
    {
      path: [],
      expected: '(root)'
    },
    {
      path: [0],
      expected: '[0]'
    },
    {
      path: [Symbol('token')],
      expected: 'Symbol(token)'
    }
  ])('whenIssuePathIsFormatted_formatIssuePath_shouldRenderExpectedPath', ({ path, expected }) => {
    // Arrange
    const tempDir = mkdtempSync(join(tmpdir(), 'cfg-src-'));
    writeConfigFiles(tempDir, buildValidEnvironment(), buildValidSecrets());
    jest.spyOn(process, 'cwd').mockReturnValue(tempDir);
    const source = new ConfigurationSourceService();
    // Action
    const result = (source as unknown as {
      formatIssuePath: (value: Array<string | number | symbol>) => string;
    }).formatIssuePath(path);
    // Assert
    expect(result).toBe(expected);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('whenFilterDefinitionEntryIsEmpty_loadFilterDefinitionsByKey_shouldSkipInvalidEntry', () => {
    // Arrange
    const tempDir = mkdtempSync(join(tmpdir(), 'cfg-src-'));
    writeConfigFiles(tempDir, buildValidEnvironment(), buildValidSecrets());
    jest.spyOn(process, 'cwd').mockReturnValue(tempDir);
    const source = new ConfigurationSourceService();
    (source as unknown as {
      environmentData: {
        filters: {
          definitions: Array<Record<string, unknown>>;
        };
      };
    }).environmentData = {
      filters: {
        definitions: [
          {},
          {
            propertyType: {
              plainOptions: ['Piso'],
              selectedPlainOptions: ['Piso']
            }
          }
        ]
      }
    };
    // Action
    const definitions = (source as unknown as {
      loadFilterDefinitionsByKey: () => Record<string, unknown>;
    }).loadFilterDefinitionsByKey();
    // Assert
    expect(definitions.propertyType).toEqual({
      plainOptions: ['Piso'],
      minOptions: [],
      maxOptions: [],
      selectedPlainOptions: ['Piso'],
      selectedMin: null,
      selectedMax: null
    });
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('whenEnvironmentOmitsFilters_loadFilterDefinitionsByKey_shouldReturnEmptyRecord', () => {
    // Arrange
    const tempDir = mkdtempSync(join(tmpdir(), 'cfg-src-'));
    const environment = buildValidEnvironment();
    delete (environment as { filters?: unknown }).filters;
    writeConfigFiles(tempDir, environment, buildValidSecrets());
    jest.spyOn(process, 'cwd').mockReturnValue(tempDir);
    const source = new ConfigurationSourceService();
    // Action
    const definitions = (source as unknown as {
      loadFilterDefinitionsByKey: () => Record<string, unknown>;
    }).loadFilterDefinitionsByKey();
    // Assert
    expect(definitions).toEqual({});
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('whenFilterDefinitionOmitsOptionalOptions_getFilterDefinitionByName_shouldDefaultMissingListsToEmpty', () => {
    // Arrange
    const tempDir = mkdtempSync(join(tmpdir(), 'cfg-src-'));
    const environment = buildValidEnvironment();
    (environment as { filters: { definitions: Array<Record<string, unknown>> } }).filters = {
      definitions: [{ propertyType: {} }]
    };
    writeConfigFiles(tempDir, environment, buildValidSecrets());
    jest.spyOn(process, 'cwd').mockReturnValue(tempDir);
    const source = new ConfigurationSourceService();
    // Action
    const definition = source.getFilterDefinitionByName('Tipo de inmueble');
    // Assert
    expect(definition).toEqual({
      plainOptions: [],
      minOptions: [],
      maxOptions: [],
      selectedPlainOptions: [],
      selectedMin: null,
      selectedMax: null
    });
    rmSync(tempDir, { recursive: true, force: true });
  });
});
