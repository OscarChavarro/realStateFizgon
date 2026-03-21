import { Inject, Injectable, Logger } from '@nestjs/common';
import { MongoDatabaseConnectionService } from 'adapters/outbound/persistence/mongodb/mongo-database-connection.service';
import { MongoPropertiesIndexService } from 'adapters/outbound/persistence/mongodb/mongo-properties-index.service';
import { PersistenceHealthPort } from 'ports/outbound/persistence/persistence-health.port';
import { CHROME_SETTINGS_PORT } from 'ports/outbound/settings/chrome-settings.port.token';
import { SLEEP_PORT } from 'ports/outbound/timing/sleep.port.token';

import type { ChromeSettingsPort } from 'ports/outbound/settings/chrome-settings.port';
import type { SleepPort } from 'ports/outbound/timing/sleep.port';

@Injectable()
export class MongoPersistenceHealthService implements PersistenceHealthPort {
  private readonly logger = new Logger(MongoPersistenceHealthService.name);

  constructor(
    @Inject(CHROME_SETTINGS_PORT)
    private readonly chromeSettingsPort: ChromeSettingsPort,
    @Inject(SLEEP_PORT)
    private readonly sleepPort: SleepPort,
    private readonly mongoDatabaseConnectionService: MongoDatabaseConnectionService,
    private readonly mongoPropertiesIndexService: MongoPropertiesIndexService
  ) {}

  async validateConnectionOrExit(): Promise<void> {
    const waitMs = this.chromeSettingsPort.chromeBrowserLaunchRetryWaitMs;
    const waitSeconds = Math.floor(waitMs / 1000);

    while (true) {
      try {
        await this.mongoDatabaseConnectionService.pingAdmin();
        await this.mongoPropertiesIndexService.ensurePropertiesCollectionAndUrlIndex();
        return;
      } catch {
        this.logger.error('MongoDB connection/authentication failed.');
        this.logger.error('Check propertyDetailScraper/secrets.json (mongodb credentials/authSource) and MongoDB network connectivity.');
        this.logger.error(
          `MongoDB validation failed. Keeping pod alive for ${waitSeconds} seconds before retrying so it can be debugged in Kubernetes.`
        );
        await this.sleepPort.sleep(waitMs);
      }
    }
  }
}
