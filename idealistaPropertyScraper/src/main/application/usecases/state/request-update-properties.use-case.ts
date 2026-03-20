import { Injectable } from '@nestjs/common';
import { ScraperStateMachineService } from 'application/services/state/scraper-state-machine.service';
import type { RequestPropertiesCommandResult } from 'ports/inbound/http/request-properties-command-result.contract';
import type { RequestUpdatePropertiesPort } from 'ports/inbound/http/request-update-properties.port';

@Injectable()
export class RequestUpdatePropertiesUseCase implements RequestUpdatePropertiesPort {
  constructor(private readonly scraperStateMachineService: ScraperStateMachineService) {}

  execute(): RequestPropertiesCommandResult {
    const pendingRequests = this.scraperStateMachineService.enqueueUpdatePropertiesRequest();
    return {
      status: 'queued',
      state: this.scraperStateMachineService.getCurrentState(),
      pendingRequests
    };
  }
}
