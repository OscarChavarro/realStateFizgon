import { Controller, Get } from '@nestjs/common';
import { PriceFixer } from '../services/datamaintenance/price-fixer.service';

@Controller()
export class FixDatabaseController {
  constructor(private readonly priceFixer: PriceFixer) {}

  @Get('fixDatabase')
  async fixDatabase(): Promise<{
    status: string;
    scanned: number;
    updated: number;
    skipped: number;
    failed: number;
  }> {
    const result = await this.priceFixer.fixDatabasePrices();
    return {
      status: 'ok',
      ...result
    };
  }
}

