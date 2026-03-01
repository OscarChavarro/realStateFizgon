import { Controller, Get } from '@nestjs/common';
import { MongoDatabaseService } from '../services/mongo-database.service';

@Controller('properties')
export class PropertiesController {
  constructor(private readonly mongoDatabaseService: MongoDatabaseService) {}

  @Get('count')
  async getPropertiesCount(): Promise<{ count: number }> {
    const count = await this.mongoDatabaseService.countProperties();
    return { count };
  }
}
