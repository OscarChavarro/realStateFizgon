import { describe, expect, it } from '@jest/globals';
import { RabbitConfig } from 'infrastructure/config/settings/rabbit.config';
import { ConfigurationSourceService } from 'infrastructure/config/settings/configuration-source.service';
import { ConfigurationSourceServiceMock } from '../../../support/mocks/configuration-source.mock';

function createRabbitConfig(params: {
  environment?: Record<string, unknown>;
  secrets?: Record<string, unknown>;
}): RabbitConfig {
  const source = new ConfigurationSourceServiceMock(
    params.environment ?? {},
    params.secrets ?? {}
  );
  return new RabbitConfig(source as unknown as ConfigurationSourceService);
}

describe('RabbitConfig', () => {
  it.each([
    {
      environment: {},
      secrets: {},
      expected: {
        host: 'localhost',
        port: 5672,
        vhost: 'dev',
        queue: 'property-listing-urls',
        user: '',
        password: ''
      }
    },
    {
      environment: {
        rabbitmq: {
          host: 'env-host',
          port: 5673
        }
      },
      secrets: {},
      expected: {
        host: 'env-host',
        port: 5673,
        vhost: 'dev',
        queue: 'property-listing-urls',
        user: '',
        password: ''
      }
    },
    {
      environment: {
        rabbitmq: {
          host: 'env-host',
          port: 5673
        }
      },
      secrets: {
        rabbitmq: {
          host: 'secret-host',
          port: 5679,
          vhost: 'prod',
          queue: 'idealista-events',
          user: 'rabbit-user',
          password: 'rabbit-pass'
        }
      },
      expected: {
        host: 'secret-host',
        port: 5679,
        vhost: 'prod',
        queue: 'idealista-events',
        user: 'rabbit-user',
        password: 'rabbit-pass'
      }
    }
  ])('whenRabbitConfigIsResolved_rabbitGetters_shouldApplyPriorityAndDefaults', ({
    environment,
    secrets,
    expected
  }) => {
    // Arrange
    const config = createRabbitConfig({ environment, secrets });
    // Action
    const values = {
      host: config.rabbitMqHost,
      port: config.rabbitMqPort,
      vhost: config.rabbitMqVhost,
      queue: config.rabbitMqQueue,
      user: config.rabbitMqUser,
      password: config.rabbitMqPassword
    };
    // Assert
    expect(values).toEqual(expected);
  });
});
