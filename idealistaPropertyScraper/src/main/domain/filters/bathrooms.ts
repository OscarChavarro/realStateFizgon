import { Filter } from 'domain/filters/filter';
import { FILTER_IDS } from 'domain/filters/filter-id';
import { FilterType } from 'domain/filters/filter-type';

export class Bathrooms extends Filter {
  constructor() {
    super(FILTER_IDS.BATHROOMS, 'Baños', 'div.item-form:has(input[name="adfilter_baths_1"])', FilterType.MULTIPLE_SELECTOR);
  }
}
