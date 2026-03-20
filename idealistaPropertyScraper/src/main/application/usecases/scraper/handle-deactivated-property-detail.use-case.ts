import { Injectable } from '@nestjs/common';
import { DeactivatedDetailStatusService } from 'src/application/services/scraper/property/deactivated-detail-status.service';
import { RuntimeClient } from 'src/application/services/scraper/property/runtime-client.type';
import { PropertyDetailStorageService } from 'src/application/services/scraper/property/property-detail-storage.service';

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
