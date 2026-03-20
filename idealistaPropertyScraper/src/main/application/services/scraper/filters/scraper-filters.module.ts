import { Module } from '@nestjs/common';
import { FilterActionExecutorService } from 'src/application/services/scraper/filters/filter-action-executor.service';
import { FilterAvailableOptionExtractorService } from 'src/application/services/scraper/filters/filter-available-option-extractor.service';
import { FilterLoaderDetectionService } from 'src/application/services/scraper/filters/filter-loader-detection.service';
import { FilterSelectedOptionExtractorService } from 'src/application/services/scraper/filters/filter-selected-option-extractor.service';
import { FilterSelectionReaderService } from 'src/application/services/scraper/filters/filter-selection-reader.service';
import { FilterTextNormalizationService } from 'src/application/services/scraper/filters/filter-text-normalization.service';
import { FiltersService } from 'src/application/services/scraper/filters/filters.service';
import { FilterUpdateService } from 'src/application/services/scraper/filters/filter-update.service';
import { ScraperChromiumModule } from 'src/application/services/chromium/scraper-chromium.module';
import { ApplySearchFiltersUseCase } from 'src/application/usecases/scraper/apply-search-filters.use-case';
import { ConfigurationModule } from 'src/infrastructure/config/settings/configuration.module';

@Module({
  imports: [ConfigurationModule, ScraperChromiumModule],
  providers: [
    FilterLoaderDetectionService,
    FilterAvailableOptionExtractorService,
    FilterSelectedOptionExtractorService,
    FilterTextNormalizationService,
    FilterSelectionReaderService,
    FilterActionExecutorService,
    FilterUpdateService,
    ApplySearchFiltersUseCase,
    FiltersService
  ],
  exports: [FiltersService]
})
export class ScraperFiltersModule {}
