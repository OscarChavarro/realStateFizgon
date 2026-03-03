import { Filter } from 'src/application/services/scraper/filters/filter.interface';
import { FilterType } from 'src/domain/filters/filter-type.enum';

export class ListingType extends Filter {
  constructor() {
    super('Tipo de anuncio', 'div.item-form:has(input[name="adfilter_agencyisabank"])', FilterType.MULTIPLE_SELECTOR);
  }
}
