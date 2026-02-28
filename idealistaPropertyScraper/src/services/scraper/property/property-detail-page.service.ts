import { Injectable, Logger } from '@nestjs/common';

type CdpClient = {
  Runtime?: {
    evaluate(params: { expression: string; returnByValue?: boolean; awaitPromise?: boolean }): Promise<unknown>;
  };
};

@Injectable()
export class PropertyDetailPageService {
  private readonly logger = new Logger(PropertyDetailPageService.name);

  async loadPropertyUrl(client: CdpClient, url: string): Promise<void> {
    void client;
    this.logger.log(`Simulating property detail processing for URL: ${url}`);
    this.logger.log('Waiting 5 seconds before moving to the next property.');
    await this.sleep(5000);
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
