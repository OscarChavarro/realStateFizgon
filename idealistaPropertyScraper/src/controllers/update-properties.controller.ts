import { Controller, Get } from '@nestjs/common';
import { ScraperState } from '../states/scraper-state.enum';
import { ScraperStateMachineService } from '../states/scraper-state-machine.service';

@Controller()
export class UpdatePropertiesController {
  constructor(private readonly scraperStateMachineService: ScraperStateMachineService) {}

  @Get('updateProperties')
  requestUpdateProperties(): { status: string; state: ScraperState; pendingRequests: number } {
    const pendingRequests = this.scraperStateMachineService.enqueueUpdatePropertiesRequest();
    return {
      status: 'queued',
      state: this.scraperStateMachineService.getCurrentState(),
      pendingRequests
    };
  }
}

