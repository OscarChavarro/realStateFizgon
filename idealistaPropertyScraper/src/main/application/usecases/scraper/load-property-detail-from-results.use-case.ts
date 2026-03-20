import { Injectable } from '@nestjs/common';
import { CdpClient } from 'src/application/services/scraper/property/cdp-client.type';
import { PropertyDetailNavigationService } from 'src/application/services/scraper/property/property-detail-navigation.service';

@Injectable()
export class LoadPropertyDetailFromResultsUseCase {
  constructor(private readonly navigationService: PropertyDetailNavigationService) {}

  async execute(
    client: CdpClient,
    url: string,
    onDetailLoaded: () => Promise<void>
  ): Promise<void> {
    const clicked = await this.navigationService.clickPropertyLinkFromResults(client.Runtime, url);
    if (!clicked) {
      throw new Error(`Property URL is not visible in current results DOM and cannot be clicked: ${url}`);
    }

    try {
      await this.navigationService.waitForDetailUrlAndDomComplete(client.Runtime, url);
      await onDetailLoaded();
    } finally {
      await this.navigationService.goBackToSearchResults(client.Runtime);
    }
  }
}
