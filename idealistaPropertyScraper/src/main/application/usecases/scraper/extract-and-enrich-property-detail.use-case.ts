import { Injectable } from '@nestjs/common';
import { GeoCoordinateHintService } from 'src/application/services/scraper/property/geo-coordinate-hint.service';
import { PropertyDetailDomExtractorService } from 'src/application/services/scraper/property/property-detail-dom-extractor.service';
import { Property } from 'src/domain/property/property.model';
import { HandleDeactivatedPropertyDetailUseCase } from 'src/application/usecases/scraper/handle-deactivated-property-detail.use-case';

import type { RuntimeClient } from 'src/ports/outbound/browser/runtime-client.port';
@Injectable()
export class ExtractAndEnrichPropertyDetailUseCase {
  constructor(
    private readonly handleDeactivatedPropertyDetailUseCase: HandleDeactivatedPropertyDetailUseCase,
    private readonly domExtractorService: PropertyDetailDomExtractorService,
    private readonly geoCoordinateHintService: GeoCoordinateHintService
  ) {}

  async execute(
    runtime: RuntimeClient,
    url: string,
    geoHintMode: 'ALWAYS' | 'ONLY_WHEN_MISSING_IN_DB'
  ): Promise<Property | null> {
    const extractedProperty = await this.domExtractorService.extractProperty(runtime, url);
    if (!extractedProperty) {
      const wasHandledAsDeactivatedAfterExtraction = await this.handleDeactivatedPropertyDetailUseCase.execute(
        runtime,
        url
      );
      if (wasHandledAsDeactivatedAfterExtraction) {
        return null;
      }

      throw new Error(`Property detail container was not found after loading URL: ${url}`);
    }

    const filteredProperty = this.domExtractorService.filterPropertyImagesByBlurPattern(extractedProperty);
    return this.geoCoordinateHintService.enrichProperty(runtime, filteredProperty, geoHintMode);
  }
}
