import { Injectable } from '@nestjs/common';
import { DeactivatedDetailStatusService } from 'application/services/scraper/property/deactivated-detail-status.service';
import { MarkPropertyClosedUseCase } from 'application/usecases/scraper/mark-property-closed.use-case';

import type { RuntimeClient } from 'ports/outbound/browser/runtime-client.port';
@Injectable()
export class HandleDeactivatedPropertyDetailUseCase {
  constructor(
    private readonly deactivatedDetailStatusService: DeactivatedDetailStatusService,
    private readonly markPropertyClosedUseCase: MarkPropertyClosedUseCase
  ) {}

  async execute(runtime: RuntimeClient, url: string): Promise<boolean> {
    const deactivatedStatus = await this.deactivatedDetailStatusService.detect(runtime);
    if (!deactivatedStatus.isDeactivated) {
      return false;
    }

    await this.markPropertyClosedUseCase.execute(url, deactivatedStatus.closedBy ?? undefined);
    return true;
  }
}
