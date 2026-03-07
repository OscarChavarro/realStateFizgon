import { Module } from '@nestjs/common';
import { FilterActionExecutorService } from 'src/application/services/scraper/filters/filter-action-executor.service';
import { FilterAvailableOptionExtractor } from 'src/application/services/scraper/filters/filter-available-option-extractor.service';
import { FilterLoaderDetectionService } from 'src/application/services/scraper/filters/filter-loader-detection.service';
import { FilterSelectedOptionExtractor } from 'src/application/services/scraper/filters/filter-selected-option-extractor.service';
import { FilterSelectionReaderService } from 'src/application/services/scraper/filters/filter-selection-reader.service';
import { FilterTextNormalizationService } from 'src/application/services/scraper/filters/filter-text-normalization.service';
import { FiltersService } from 'src/application/services/scraper/filters/filters.service';
import { FilterUpdateService } from 'src/application/services/scraper/filters/filter-update.service';
import { ConfigurationModule } from 'src/infrastructure/config/configuration.module';

@Module({
  imports: [ConfigurationModule],
  providers: [
    FilterLoaderDetectionService,
    FilterAvailableOptionExtractor,
    FilterSelectedOptionExtractor,
    FilterTextNormalizationService,
    FilterSelectionReaderService,
    FilterActionExecutorService,
    FilterUpdateService,
    FiltersService
  ],
  exports: [FiltersService]
})
export class ScraperFiltersModule {}
