import { Controller, Post, UseGuards } from '@nestjs/common';
import { EndpointsBasicAuthGuard } from 'src/adapters/inbound/http/endpoints-basic-auth.guard';
import { ScraperState } from 'src/domain/states/scraper-state.enum';
import { RequestUpdatePropertiesUseCase } from 'src/application/usecases/request-update-properties.use-case';
import { ScraperStateMachineService } from 'src/application/services/state/scraper-state-machine.service';

@Controller()
@UseGuards(EndpointsBasicAuthGuard)
export class UpdatePropertiesController {
  constructor(
    private readonly requestUpdatePropertiesUseCase: RequestUpdatePropertiesUseCase,
    private readonly scraperStateMachineService: ScraperStateMachineService
  ) {}

  @Post('updateProperties')
  requestUpdateProperties(): { status: string; state: ScraperState; pendingRequests: number } {
    return this.requestUpdatePropertiesUseCase.execute();
  }

  @Post('scrapeProperties')
  requestScrapeProperties(): { status: string; state: ScraperState; pendingRequests: number } {
    const pendingRequests = this.scraperStateMachineService.enqueueScrapePropertiesRequest();
    return {
      status: 'queued',
      state: this.scraperStateMachineService.getCurrentState(),
      pendingRequests
    };
  }
}
