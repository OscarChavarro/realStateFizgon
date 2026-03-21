import { Filter } from 'domain/filters/filter';
import { FILTER_IDS } from 'domain/filters/filter-id';
import { FilterType } from 'domain/filters/filter-type';

export class ListingType extends Filter {
  constructor() {
    super(FILTER_IDS.LISTING_TYPE, 'Tipo de anuncio', 'div.item-form:has(input[name="adfilter_agencyisabank"])', FilterType.MULTIPLE_SELECTOR);
  }
}
