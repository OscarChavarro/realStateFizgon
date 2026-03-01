import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PropertiesUpdatesGateway } from '../gateways/properties-updates.gateway';
import { MongoDatabaseService } from './mongo-database.service';

@Injectable()
export class PropertiesMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PropertiesMonitorService.name);
  private lastKnownCount: number | null = null;
  private intervalRef: NodeJS.Timeout | null = null;

  constructor(
    private readonly mongoDatabaseService: MongoDatabaseService,
    private readonly propertiesUpdatesGateway: PropertiesUpdatesGateway
  ) {}

  async onModuleInit(): Promise<void> {
    await this.checkAndBroadcastCount();
    this.intervalRef = setInterval(() => {
      void this.checkAndBroadcastCount();
    }, 1000);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }
  }

  private async checkAndBroadcastCount(): Promise<void> {
    try {
      const currentCount = await this.mongoDatabaseService.countProperties();
      if (this.lastKnownCount === null || currentCount !== this.lastKnownCount) {
        this.lastKnownCount = currentCount;
        this.logger.log(`Properties collection count updated: ${currentCount}`);
        this.propertiesUpdatesGateway.emitPropertiesCountUpdated(currentCount);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed checking properties count: ${message}`);
    }
  }
}
