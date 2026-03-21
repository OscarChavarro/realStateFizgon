import { Filter } from 'domain/filters/filter';
import { FilterType } from 'domain/filters/filter-type';

export class Bathrooms extends Filter {
  constructor() {
    super('Baños', 'div.item-form:has(input[name="adfilter_baths_1"])', FilterType.MULTIPLE_SELECTOR);
  }
}
