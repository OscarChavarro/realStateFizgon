import { describe, expect, it } from '@jest/globals';
import { MongoConfig } from 'src/infrastructure/config/settings/mongo.config';
import { ConfigurationSourceService } from 'src/infrastructure/config/settings/configuration-source.service';

type ConfigurationSourceMockShape = {
  environment: Record<string, unknown>;
  secrets: {
    mongodb?: {
      host?: string;
      port?: number;
      database?: string;
      authSource?: string;
      user?: string;
      password?: string;
    };
  };
};

describe('MongoConfig', () => {
  it('whenMongoSecretsAreMissing_mongoGetters_shouldReturnDefaultValues', () => {
    // Arrange
    const source: ConfigurationSourceMockShape = { environment: {}, secrets: {} };
    const config = new MongoConfig(source as unknown as ConfigurationSourceService);
    // Action
    const values = {
      host: config.mongoHost,
      port: config.mongoPort,
      database: config.mongoDatabase,
      authSource: config.mongoAuthSource
    };
    // Assert
    expect(values).toEqual({
      host: 'localhost',
      port: 27017,
      database: 'idealistaScraper',
      authSource: 'idealistaScraper'
    });
  });

  it('whenMongoCredentialsAreMissing_mongoUserAndPassword_shouldReturnEmptyStrings', () => {
    // Arrange
    const source: ConfigurationSourceMockShape = {
      environment: {},
      secrets: {
        mongodb: {
          host: 'mongo.internal',
          port: 27017,
          database: 'properties'
        }
      }
    };
    const config = new MongoConfig(source as unknown as ConfigurationSourceService);
    // Action
    const credentials = { user: config.mongoUser, password: config.mongoPassword };
    // Assert
    expect(credentials).toEqual({ user: '', password: '' });
  });

  it.each([
    {
      user: 'user@name',
      password: 'p@ss/word',
      authSource: 'admin/db',
      expectedFragment: 'mongodb://user%40name:p%40ss%2Fword@'
    },
    {
      user: 'plain',
      password: 'plain',
      authSource: 'admin',
      expectedFragment: 'mongodb://plain:plain@'
    }
  ])('whenMongoSecretsContainCredentials_mongoConnectionUri_shouldEncodeSensitiveParts', ({
    user,
    password,
    authSource,
    expectedFragment
  }) => {
    // Arrange
    const source: ConfigurationSourceMockShape = {
      environment: {},
      secrets: {
        mongodb: {
          host: 'mongo.internal',
          port: 27018,
          database: 'properties',
          authSource,
          user,
          password
        }
      }
    };
    const config = new MongoConfig(source as unknown as ConfigurationSourceService);
    // Action
    const uri = config.mongoConnectionUri;
    // Assert
    expect(uri).toContain(expectedFragment);
    expect(uri).toContain('mongo.internal:27018/properties');
    expect(uri).toContain(`authSource=${encodeURIComponent(authSource)}`);
  });
});
