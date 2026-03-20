import { Injectable } from '@nestjs/common';
import { CdpClient } from 'src/application/services/scraper/property/cdp-client.type';
import { PropertyDetailNavigationService } from 'src/application/services/scraper/property/property-detail-navigation.service';

@Injectable()
export class RevalidatePropertyDetailFromDatabaseUseCase {
  constructor(private readonly navigationService: PropertyDetailNavigationService) {}

  async execute(
    client: CdpClient,
    url: string,
    onDetailLoaded: () => Promise<void>
  ): Promise<void> {
    try {
      await this.navigationService.navigateDirectlyToUrl(client.Runtime, url);
      await onDetailLoaded();
    } finally {
      await this.navigationService.goBackToSearchResults(client.Runtime);
    }
  }
}
