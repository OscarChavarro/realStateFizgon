import { Controller, Post, UseGuards } from '@nestjs/common';
import { EndpointsBasicAuthGuard } from 'src/adapters/inbound/http/endpoints-basic-auth.guard';
import { ScraperState } from 'src/domain/states/scraper-state.enum';
import { RequestScrapePropertiesUseCase } from 'src/application/usecases/request-scrape-properties.use-case';
import { RequestUpdatePropertiesUseCase } from 'src/application/usecases/request-update-properties.use-case';

@Controller()
@UseGuards(EndpointsBasicAuthGuard)
export class UpdatePropertiesController {
  constructor(
    private readonly requestUpdatePropertiesUseCase: RequestUpdatePropertiesUseCase,
    private readonly requestScrapePropertiesUseCase: RequestScrapePropertiesUseCase
  ) {}

  @Post('updateProperties')
  requestUpdateProperties(): { status: string; state: ScraperState; pendingRequests: number } {
    return this.requestUpdatePropertiesUseCase.execute();
  }

  @Post('scrapeProperties')
  requestScrapeProperties(): { status: string; state: ScraperState; pendingRequests: number } {
    return this.requestScrapePropertiesUseCase.execute();
  }
}
