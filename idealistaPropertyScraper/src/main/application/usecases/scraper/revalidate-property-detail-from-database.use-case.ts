import { Injectable } from '@nestjs/common';
import { PropertyDetailNavigationService } from 'application/services/scraper/property/property-detail-navigation.service';

import type { PropertyCdpClient } from 'ports/outbound/browser/property-cdp-client.port';
@Injectable()
export class RevalidatePropertyDetailFromDatabaseUseCase {
  constructor(private readonly navigationService: PropertyDetailNavigationService) {}

  async execute(
    client: PropertyCdpClient,
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
