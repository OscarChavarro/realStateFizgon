import { Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { EndpointsBasicAuthGuard } from 'adapters/inbound/http/endpoints-basic-auth.guard';
import { REQUEST_SCRAPE_PROPERTIES_PORT } from 'ports/inbound/http/request-scrape-properties.port.token';
import { REQUEST_UPDATE_PROPERTIES_PORT } from 'ports/inbound/http/request-update-properties.port.token';

import type { RequestPropertiesCommandResult } from 'ports/inbound/http/request-properties-command-result.contract';
import type { RequestScrapePropertiesPort } from 'ports/inbound/http/request-scrape-properties.port';
import type { RequestUpdatePropertiesPort } from 'ports/inbound/http/request-update-properties.port';

@Controller()
@UseGuards(EndpointsBasicAuthGuard)
export class UpdatePropertiesController {
  constructor(
    @Inject(REQUEST_UPDATE_PROPERTIES_PORT)
    private readonly requestUpdatePropertiesPort: RequestUpdatePropertiesPort,
    @Inject(REQUEST_SCRAPE_PROPERTIES_PORT)
    private readonly requestScrapePropertiesPort: RequestScrapePropertiesPort
  ) {}

  @Post('updateProperties')
  requestUpdateProperties(): RequestPropertiesCommandResult {
    return this.requestUpdatePropertiesPort.execute();
  }

  @Post('scrapeProperties')
  requestScrapeProperties(): RequestPropertiesCommandResult {
    return this.requestScrapePropertiesPort.execute();
  }
}
