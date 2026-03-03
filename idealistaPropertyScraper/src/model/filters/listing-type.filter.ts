import { Filter } from 'src/services/scraper/filters/filter.interface';
import { FilterType } from 'src/model/filters/filter-type.enum';

export class ListingType extends Filter {
  constructor() {
    super('Tipo de anuncio', 'div.item-form:has(input[name="adfilter_agencyisabank"])', FilterType.MULTIPLE_SELECTOR);
  }
}
