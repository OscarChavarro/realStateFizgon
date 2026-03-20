import { Injectable } from '@nestjs/common';
import { DeactivatedDetailStatusService } from 'application/services/scraper/property/deactivated-detail-status.service';
import { PropertyDetailStorageService } from 'application/services/scraper/property/property-detail-storage.service';

import type { RuntimeClient } from 'ports/outbound/browser/runtime-client.port';
@Injectable()
export class HandleDeactivatedPropertyDetailUseCase {
  constructor(
    private readonly deactivatedDetailStatusService: DeactivatedDetailStatusService,
    private readonly storageService: PropertyDetailStorageService
  ) {}

  async execute(runtime: RuntimeClient, url: string): Promise<boolean> {
    const deactivatedStatus = await this.deactivatedDetailStatusService.detect(runtime);
    if (!deactivatedStatus.isDeactivated) {
      return false;
    }

    await this.storageService.markPropertyClosed(url, deactivatedStatus.closedBy ?? undefined);
    return true;
  }
}
