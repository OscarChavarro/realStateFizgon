import { Injectable, Logger } from '@nestjs/common';
import { MongoDatabaseService } from '../mongodb/mongo-database.service';

@Injectable()
export class PriceFixer {
  private readonly logger = new Logger(PriceFixer.name);

  constructor(private readonly mongoDatabaseService: MongoDatabaseService) {}

  async fixDatabasePrices(): Promise<{
    scanned: number;
    updated: number;
    skipped: number;
    failed: number;
  }> {
    const result = await this.mongoDatabaseService.fixStringPricesToNumbers();
    this.logger.log(
      `Price fix finished. scanned=${result.scanned}, updated=${result.updated}, skipped=${result.skipped}, failed=${result.failed}.`
    );
    return result;
  }
}

