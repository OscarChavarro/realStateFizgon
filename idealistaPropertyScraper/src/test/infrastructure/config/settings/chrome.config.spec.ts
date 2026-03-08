import { describe, expect, it } from '@jest/globals';
import { ChromeConfig } from 'src/infrastructure/config/settings/chrome.config';
import { ConfigurationSourceService } from 'src/infrastructure/config/settings/configuration-source.service';
import { ConfigurationSourceServiceMock } from '../../../support/mocks/configuration-source.mock';

function createChromeConfig(params: {
  environment?: Record<string, unknown>;
  secrets?: Record<string, unknown>;
}): ChromeConfig {
  const source = new ConfigurationSourceServiceMock(
    params.environment ?? {},
    params.secrets ?? {}
  );
  return new ChromeConfig(source as unknown as ConfigurationSourceService);
}

describe('ChromeConfig', () => {
  it.each([
    {
      getter: (config: ChromeConfig) => config.chromeBinary,
      expected: '/usr/bin/chrome'
    },
    {
      getter: (config: ChromeConfig) => config.chromeAcceptLanguage,
      expected: 'en-US,en;q=0.9,es;q=0.8'
    },
    {
      getter: (config: ChromeConfig) => config.proxyHost,
      expected: 'proxy.internal'
    },
    {
      getter: (config: ChromeConfig) => config.proxyPort,
      expected: 8080
    },
    {
      getter: (config: ChromeConfig) => config.chromeOriginErrorReloadWaitMs,
      expected: 2500
    }
  ])('whenChromeGetterIsRequested_getter_shouldReturnConfiguredValue', ({ getter, expected }) => {
    // Arrange
    const config = createChromeConfig({
      environment: {
        chrome: { binary: '/usr/bin/chrome' },
        timeouts: {
          chrome: {
            originerrorreloadwait: 2500
          }
        }
      },
      secrets: {
        chrome: {
          acceptLanguage: ' en-US,en;q=0.9,es;q=0.8 '
        },
        proxy: {
          host: ' proxy.internal ',
          port: '8080'
        }
      }
    });
    // Action
    const result = getter(config);
    // Assert
    expect(result).toBe(expected);
  });

  it.each([
    {
      secrets: {},
      expected: {}
    },
    {
      secrets: {
        chrome: {
          extraHeaders: 'invalid'
        }
      },
      expected: {}
    }
  ])('whenExtraHeadersAreMissingOrInvalid_chromeExtraHeaders_shouldReturnEmptyObject', ({ secrets, expected }) => {
    // Arrange
    const config = createChromeConfig({
      environment: { chrome: { binary: '/usr/bin/chrome' } },
      secrets
    });
    // Action
    const headers = config.chromeExtraHeaders;
    // Assert
    expect(headers).toEqual(expected);
  });

  it('whenChromePathIsBlank_chromePath_shouldReturnDefaultPath', () => {
    // Arrange
    const config = createChromeConfig({
      environment: { chrome: { binary: '/usr/bin/chrome' } },
      secrets: { chrome: { path: '   ' } }
    });
    // Action
    const result = config.chromePath;
    // Assert
    expect(result).toBe('/tmp/googleChromeIdealistaScraper');
  });

  it('whenExtraHeadersContainInvalidEntries_chromeExtraHeaders_shouldReturnSanitizedHeaders', () => {
    // Arrange
    const config = createChromeConfig({
      environment: { chrome: { binary: '/usr/bin/chrome' } },
      secrets: {
        chrome: {
          extraHeaders: {
            ' Accept-Language ': ' en-US,en;q=0.9 ',
            '': 'x',
            Dnt: '',
            'Cache-Control': ' max-age=0 '
          }
        }
      }
    });
    // Action
    const headers = config.chromeExtraHeaders;
    // Assert
    expect(headers).toEqual({
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'max-age=0'
    });
  });

  it('whenProxyAndUserAgentAreConfigured_chromiumOptions_shouldAppendNormalizedOptions', () => {
    // Arrange
    const config = createChromeConfig({
      environment: { chrome: { binary: '/usr/bin/chrome' } },
      secrets: {
        chrome: {
          userAgent: ' Mozilla/5.0 custom ',
          chromiumOptions: ['--enable-webgl']
        },
        proxy: {
          enable: true,
          host: 'proxy.internal',
          port: 8080
        }
      }
    });
    // Action
    const options = config.chromiumOptions;
    // Assert
    expect(options).toEqual([
      '--enable-webgl',
      '--proxy-server=http://proxy.internal:8080',
      '--user-agent=Mozilla/5.0 custom'
    ]);
  });

  it.each([
    {
      proxy: { enable: true, host: '', port: 8080 }
    },
    {
      proxy: { enable: true, host: 'proxy.internal', port: '' }
    },
    {
      proxy: { enable: false, host: 'proxy.internal', port: 8080 }
    }
  ])('whenProxyConfigurationIsInvalid_chromiumOptions_shouldSkipProxyOption', ({ proxy }) => {
    // Arrange
    const config = createChromeConfig({
      environment: { chrome: { binary: '/usr/bin/chrome' } },
      secrets: {
        chrome: {
          chromiumOptions: ['--base']
        },
        proxy
      }
    });
    // Action
    const options = config.chromiumOptions;
    // Assert
    expect(options).toEqual(['--base']);
  });

  it.each([
    {
      geolocation: { latitude: '40.4167', longitude: '-3.7033', accuracy: 30 },
      expected: { latitude: 40.4167, longitude: -3.7033, accuracy: 30 }
    },
    {
      geolocation: { latitude: 'invalid', longitude: '-3.7033', accuracy: 30 },
      expected: undefined
    },
    {
      geolocation: { latitude: '40.4167', longitude: 'invalid' },
      expected: undefined
    }
  ])('whenGeolocationIsRequested_geolocationOverride_shouldReturnExpectedValue', ({ geolocation, expected }) => {
    // Arrange
    const config = createChromeConfig({
      environment: { chrome: { binary: '/usr/bin/chrome' } },
      secrets: { geolocation }
    });
    // Action
    const override = config.geolocationOverride;
    // Assert
    expect(override).toEqual(expected);
  });

  it('whenAllowlistContainsNoise_geolocationAllowlist_shouldReturnTrimmedEntries', () => {
    // Arrange
    const config = createChromeConfig({
      environment: { chrome: { binary: '/usr/bin/chrome' } },
      secrets: {
        geolocation: {
          allowlist: [' https://idealista.com ', '', '   ', 'https://browserleaks.com']
        }
      }
    });
    // Action
    const allowlist = config.geolocationAllowlist;
    // Assert
    expect(allowlist).toEqual([
      'https://idealista.com',
      'https://browserleaks.com'
    ]);
  });

  it('whenGeolocationConfigIsMissing_geolocationOverride_shouldReturnUndefined', () => {
    // Arrange
    const config = createChromeConfig({
      environment: { chrome: { binary: '/usr/bin/chrome' } },
      secrets: {}
    });
    // Action
    const override = config.geolocationOverride;
    // Assert
    expect(override).toBeUndefined();
  });

  it('whenAllowlistIsNotArray_geolocationAllowlist_shouldReturnEmptyArray', () => {
    // Arrange
    const config = createChromeConfig({
      environment: { chrome: { binary: '/usr/bin/chrome' } },
      secrets: {
        geolocation: {
          allowlist: 'invalid'
        }
      }
    });
    // Action
    const allowlist = config.geolocationAllowlist;
    // Assert
    expect(allowlist).toEqual([]);
  });

  it.each([
    {
      getter: (config: ChromeConfig) => config.chromeCdpReadyTimeoutMs,
      expected: 60000
    },
    {
      getter: (config: ChromeConfig) => config.chromeCdpRequestTimeoutMs,
      expected: 2000
    },
    {
      getter: (config: ChromeConfig) => config.chromeCdpPollIntervalMs,
      expected: 500
    },
    {
      getter: (config: ChromeConfig) => config.chromeExpressionTimeoutMs,
      expected: 30000
    },
    {
      getter: (config: ChromeConfig) => config.chromeExpressionPollIntervalMs,
      expected: 200
    },
    {
      getter: (config: ChromeConfig) => config.chromeBrowserLaunchRetryWaitMs,
      expected: 3600000
    }
  ])('whenTimeoutValuesAreMissing_timeoutGetter_shouldReturnDefault', ({ getter, expected }) => {
    // Arrange
    const config = createChromeConfig({
      environment: { chrome: { binary: '/usr/bin/chrome' } },
      secrets: {}
    });
    // Action
    const value = getter(config);
    // Assert
    expect(value).toBe(expected);
  });
});
