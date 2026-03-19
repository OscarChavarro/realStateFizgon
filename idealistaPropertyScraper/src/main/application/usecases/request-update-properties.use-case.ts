import { Injectable } from '@nestjs/common';
import { ScraperStateMachineService } from 'src/application/services/state/scraper-state-machine.service';
import { ScraperState } from 'src/domain/states/scraper-state.enum';

type RequestUpdatePropertiesResult = {
  status: string;
  state: ScraperState;
  pendingRequests: number;
};

@Injectable()
export class RequestUpdatePropertiesUseCase {
  constructor(private readonly scraperStateMachineService: ScraperStateMachineService) {}

  execute(): RequestUpdatePropertiesResult {
    const pendingRequests = this.scraperStateMachineService.enqueueUpdatePropertiesRequest();
    return {
      status: 'queued',
      state: this.scraperStateMachineService.getCurrentState(),
      pendingRequests
    };
  }
}
