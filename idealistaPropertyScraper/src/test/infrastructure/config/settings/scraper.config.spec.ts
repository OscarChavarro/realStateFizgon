import { describe, expect, it } from '@jest/globals';
import { ScraperConfig } from 'infrastructure/config/settings/scraper.config';
import { ConfigurationSourceService } from 'infrastructure/config/settings/configuration-source.service';
import { FilterDefinition } from 'infrastructure/config/settings/filter-definition.type';
import { ScraperState } from 'domain/states/scraper-state';
import { ConfigurationSourceServiceMock } from '../../../support/mocks/configuration-source.mock';

function createScraperConfig(params: {
  environment?: Record<string, unknown>;
  secrets?: Record<string, unknown>;
  definitions?: Record<string, FilterDefinition | undefined>;
}): ScraperConfig {
  const source = new ConfigurationSourceServiceMock(
    params.environment ?? {},
    params.secrets ?? {},
    params.definitions ?? {}
  );
  return new ScraperConfig(source as unknown as ConfigurationSourceService);
}

describe('ScraperConfig', () => {
  it('whenHomeConfigurationExists_scraperHomeGetters_shouldReturnConfiguredValues', () => {
    // Arrange
    const config = createScraperConfig({
      environment: {
        scraper: {
          home: {
            url: 'https://www.idealista.com/',
            mainSearchArea: 'Madrid'
          }
        }
      }
    });
    // Action
    const values = {
      homeUrl: config.scraperHomeUrl,
      mainSearchArea: config.mainSearchArea
    };
    // Assert
    expect(values).toEqual({
      homeUrl: 'https://www.idealista.com/',
      mainSearchArea: 'Madrid'
    });
  });

  it.each([
    {
      environment: {
        timeouts: {
          propertydetailpage: {
            cookieapprovaldialogwaitms: 2500
          }
        }
      },
      expected: 2500
    },
    {
      environment: {
        timeouts: {
          propertydetailpage: {
            cookieaprovaldialogwaitms: 1800
          }
        }
      },
      expected: 1800
    },
    {
      environment: {
        timeouts: {
          propertydetailpage: {}
        }
      },
      expected: 2000
    }
  ])('whenCookieDialogTimeoutIsRead_cookieApprovalDialogWaitMs_shouldApplyFallbackOrder', ({
    environment,
    expected
  }) => {
    // Arrange
    const config = createScraperConfig({ environment });
    // Action
    const timeout = config.cookieApprovalDialogWaitMs;
    // Assert
    expect(timeout).toBe(expected);
  });

  it.each([
    {
      environment: { initialState: 'SCRAPING_FOR_NEW_PROPERTIES' },
      expected: ScraperState.SCRAPING_FOR_NEW_PROPERTIES
    },
    {
      environment: { initialState: 'UPDATING_PROPERTIES' },
      expected: ScraperState.UPDATING_PROPERTIES
    },
    {
      environment: { initialState: 'UNKNOWN_STATE' },
      expected: ScraperState.IDLE
    },
    {
      environment: {},
      expected: ScraperState.IDLE
    }
  ])('whenInitialStateIsParsed_initialScraperState_shouldReturnResolvedState', ({
    environment,
    expected
  }) => {
    // Arrange
    const config = createScraperConfig({ environment });
    // Action
    const state = config.initialScraperState;
    // Assert
    expect(state).toBe(expected);
  });

  it.each([
    { rawPort: 8080, expected: 8080 },
    { rawPort: 1, expected: 1 },
    { rawPort: 0, expected: 1 },
    { rawPort: -3, expected: 1 }
  ])('whenApiPortIsResolved_apiHttpPort_shouldNeverBeLowerThanOne', ({ rawPort, expected }) => {
    // Arrange
    const config = createScraperConfig({
      environment: {
        api: {
          httpPort: rawPort
        }
      }
    });
    // Action
    const apiPort = config.apiHttpPort;
    // Assert
    expect(apiPort).toBe(expected);
  });

  it('whenApiPortIsMissing_apiHttpPort_shouldReturnDefaultPort', () => {
    // Arrange
    const config = createScraperConfig({
      environment: {}
    });
    // Action
    const apiPort = config.apiHttpPort;
    // Assert
    expect(apiPort).toBe(3000);
  });

  it.each([
    {
      environment: { scheduler: { reScrapeIntervalMs: 60000 } },
      expected: 60000
    },
    {
      environment: { scheduler: { reScrapeIntervalMs: -1 } },
      expected: 0
    },
    {
      environment: {},
      expected: 900000
    }
  ])('whenRescrapeIntervalIsResolved_reScrapeIntervalMs_shouldReturnExpectedValue', ({
    environment,
    expected
  }) => {
    // Arrange
    const config = createScraperConfig({ environment });
    // Action
    const value = config.reScrapeIntervalMs;
    // Assert
    expect(value).toBe(expected);
  });

  it('whenFilterDefinitionIsRequested_getFilterDefinitionByName_shouldDelegateToSource', () => {
    // Arrange
    const definition: FilterDefinition = {
      plainOptions: ['new'],
      minOptions: [],
      maxOptions: [],
      selectedPlainOptions: ['new'],
      selectedMin: null,
      selectedMax: null
    };
    const config = createScraperConfig({
      definitions: {
        'Tipo de inmueble': definition
      }
    });
    // Action
    const result = config.getFilterDefinitionByName('Tipo de inmueble');
    // Assert
    expect(result).toBe(definition);
  });

  it('whenEndpointCredentialsAreConfigured_endpointsGetters_shouldReturnConfiguredCredentials', () => {
    // Arrange
    const config = createScraperConfig({
      secrets: {
        endpoints: {
          user: 'api-user',
          password: 'api-password'
        }
      }
    });
    // Action
    const credentials = {
      user: config.endpointsUser,
      password: config.endpointsPassword
    };
    // Assert
    expect(credentials).toEqual({
      user: 'api-user',
      password: 'api-password'
    });
  });

  it.each([
    {
      getter: (config: ScraperConfig) => config.mainPageExpressionTimeoutMs,
      expected: 30000
    },
    {
      getter: (config: ScraperConfig) => config.mainPageExpressionPollIntervalMs,
      expected: 200
    },
    {
      getter: (config: ScraperConfig) => config.mainPageSearchClickWaitMs,
      expected: 1000
    },
    {
      getter: (config: ScraperConfig) => config.mainPageFirstLoadDeviceVerificationWaitMs,
      expected: 30000
    },
    {
      getter: (config: ScraperConfig) => config.filterStateClickWaitMs,
      expected: 2000
    },
    {
      getter: (config: ScraperConfig) => config.filterListingLoadingTimeoutMs,
      expected: 10000
    },
    {
      getter: (config: ScraperConfig) => config.filterListingLoadingPollIntervalMs,
      expected: 200
    },
    {
      getter: (config: ScraperConfig) => config.paginationClickWaitMs,
      expected: 1000
    },
    {
      getter: (config: ScraperConfig) => config.imageDownloadFolder,
      expected: './output/images'
    },
    {
      getter: (config: ScraperConfig) => config.propertyDetailPageScrollIntervalMs,
      expected: 200
    },
    {
      getter: (config: ScraperConfig) => config.propertyDetailPageScrollEvents,
      expected: 10
    },
    {
      getter: (config: ScraperConfig) => config.propertyDetailPageImagesLoadWaitMs,
      expected: 2000
    },
    {
      getter: (config: ScraperConfig) => config.propertyDetailPageMorePhotosClickWaitMs,
      expected: 400
    },
    {
      getter: (config: ScraperConfig) => config.propertyDetailPagePreMediaExpansionWaitMs,
      expected: 1000
    }
  ])('whenScraperTimeoutsAreMissing_scraperTimeoutGetter_shouldReturnDefault', ({ getter, expected }) => {
    // Arrange
    const config = createScraperConfig({ environment: {} });
    // Action
    const value = getter(config);
    // Assert
    expect(value).toBe(expected);
  });
});
