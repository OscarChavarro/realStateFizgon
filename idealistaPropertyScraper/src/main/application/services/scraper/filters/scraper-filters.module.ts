import { Module } from '@nestjs/common';
import { FilterActionExecutorService } from 'application/services/scraper/filters/filter-action-executor.service';
import { FilterAvailableOptionExtractorService } from 'application/services/scraper/filters/filter-available-option-extractor.service';
import { FilterLoaderDetectionService } from 'application/services/scraper/filters/filter-loader-detection.service';
import { FilterSelectedOptionExtractorService } from 'application/services/scraper/filters/filter-selected-option-extractor.service';
import { FilterSelectionReaderService } from 'application/services/scraper/filters/filter-selection-reader.service';
import { FilterTextNormalizationService } from 'application/services/scraper/filters/filter-text-normalization.service';
import { FiltersService } from 'application/services/scraper/filters/filters.service';
import { FilterUpdateService } from 'application/services/scraper/filters/filter-update.service';
import { ScraperChromiumModule } from 'application/services/chromium/scraper-chromium.module';
import { ApplySearchFiltersUseCase } from 'application/usecases/scraper/apply-search-filters.use-case';

@Module({
  imports: [ScraperChromiumModule],
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
