import { Injectable } from '@nestjs/common';
import { ScraperCdpClient } from 'src/application/services/chromium/scraper-cdp-client.type';
import { ExecuteUpdateExistingPropertiesFlowUseCase } from 'src/application/usecases/execute-update-existing-properties-flow.use-case';

@Injectable()
export class UpdateExistingPropertiesFlowService {
  constructor(private readonly executeUpdateExistingPropertiesFlowUseCase: ExecuteUpdateExistingPropertiesFlowUseCase) {}

  async execute(client: ScraperCdpClient): Promise<void> {
    await this.executeUpdateExistingPropertiesFlowUseCase.execute(client);
  }
}
