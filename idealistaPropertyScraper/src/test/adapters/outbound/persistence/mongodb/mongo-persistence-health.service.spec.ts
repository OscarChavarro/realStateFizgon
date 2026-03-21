import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { MongoDatabaseConnectionService } from 'adapters/outbound/persistence/mongodb/mongo-database-connection.service';
import { MongoPersistenceHealthService } from 'adapters/outbound/persistence/mongodb/mongo-persistence-health.service';
import { MongoPropertiesIndexService } from 'adapters/outbound/persistence/mongodb/mongo-properties-index.service';
import { ChromeConfigMock } from '../../../../support/mocks/chrome-config.mock';

class SleepPortMock {
  readonly sleep = jest.fn<(ms: number) => Promise<void>>(async () => undefined);
}

class MongoDatabaseConnectionServiceMock {
  readonly pingAdmin = jest.fn<() => Promise<void>>();
}

class MongoPropertiesIndexServiceMock {
  readonly ensurePropertiesCollectionAndUrlIndex = jest.fn<() => Promise<void>>();
}

function createService(
  sleepPort: SleepPortMock = new SleepPortMock(),
  mongoDatabaseConnectionService: MongoDatabaseConnectionServiceMock = new MongoDatabaseConnectionServiceMock(),
  mongoPropertiesIndexService: MongoPropertiesIndexServiceMock = new MongoPropertiesIndexServiceMock()
) {
  const service = new MongoPersistenceHealthService(
    new ChromeConfigMock() as never,
    sleepPort as never,
    mongoDatabaseConnectionService as unknown as MongoDatabaseConnectionService,
    mongoPropertiesIndexService as unknown as MongoPropertiesIndexService
  );

  return {
    service,
    sleepPort,
    mongoDatabaseConnectionService,
    mongoPropertiesIndexService
  };
}

describe('MongoPersistenceHealthService', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('whenValidationFailsThenSucceeds_validateConnectionOrExit_shouldRetryAfterSleep', async () => {
    // Arrange
    const { service, sleepPort, mongoDatabaseConnectionService, mongoPropertiesIndexService } = createService();
    mongoDatabaseConnectionService.pingAdmin
      .mockRejectedValueOnce(new Error('connection failed'))
      .mockResolvedValue(undefined);
    mongoPropertiesIndexService.ensurePropertiesCollectionAndUrlIndex.mockResolvedValue(undefined);
    // Action
    await service.validateConnectionOrExit();
    // Assert
    expect(mongoDatabaseConnectionService.pingAdmin).toHaveBeenCalledTimes(2);
    expect(mongoPropertiesIndexService.ensurePropertiesCollectionAndUrlIndex).toHaveBeenCalledTimes(1);
    expect(sleepPort.sleep).toHaveBeenCalledTimes(1);
    expect(sleepPort.sleep).toHaveBeenCalledWith((new ChromeConfigMock()).chromeBrowserLaunchRetryWaitMs);
  });

  it('whenPingSucceedsButIndexPreparationFails_validateConnectionOrExit_shouldRetryEntireValidation', async () => {
    // Arrange
    const { service, sleepPort, mongoDatabaseConnectionService, mongoPropertiesIndexService } = createService();
    mongoDatabaseConnectionService.pingAdmin.mockResolvedValue(undefined);
    mongoPropertiesIndexService.ensurePropertiesCollectionAndUrlIndex
      .mockRejectedValueOnce(new Error('index failure'))
      .mockResolvedValue(undefined);
    // Action
    await service.validateConnectionOrExit();
    // Assert
    expect(mongoDatabaseConnectionService.pingAdmin).toHaveBeenCalledTimes(2);
    expect(mongoPropertiesIndexService.ensurePropertiesCollectionAndUrlIndex).toHaveBeenCalledTimes(2);
    expect(sleepPort.sleep).toHaveBeenCalledTimes(1);
  });

  it('whenValidationSucceedsImmediately_validateConnectionOrExit_shouldReturnWithoutSleeping', async () => {
    // Arrange
    const { service, sleepPort, mongoDatabaseConnectionService, mongoPropertiesIndexService } = createService();
    mongoDatabaseConnectionService.pingAdmin.mockResolvedValue(undefined);
    mongoPropertiesIndexService.ensurePropertiesCollectionAndUrlIndex.mockResolvedValue(undefined);
    // Action
    await service.validateConnectionOrExit();
    // Assert
    expect(mongoDatabaseConnectionService.pingAdmin).toHaveBeenCalledTimes(1);
    expect(mongoPropertiesIndexService.ensurePropertiesCollectionAndUrlIndex).toHaveBeenCalledTimes(1);
    expect(sleepPort.sleep).not.toHaveBeenCalled();
  });
});
