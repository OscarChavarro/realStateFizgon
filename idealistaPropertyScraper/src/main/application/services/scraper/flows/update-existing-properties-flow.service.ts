import { Injectable } from '@nestjs/common';
import { ExecuteUpdateExistingPropertiesFlowUseCase } from 'application/usecases/scraper/execute-update-existing-properties-flow.use-case';

import type { ScraperCdpClient } from 'ports/outbound/browser/scraper-cdp-client.port';
@Injectable()
export class UpdateExistingPropertiesFlowService {
  constructor(private readonly executeUpdateExistingPropertiesFlowUseCase: ExecuteUpdateExistingPropertiesFlowUseCase) {}

  async execute(client: ScraperCdpClient): Promise<void> {
    await this.executeUpdateExistingPropertiesFlowUseCase.execute(client);
  }
}
