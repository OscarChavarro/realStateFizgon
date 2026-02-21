import { Filter } from '../filter.interface';
import { FilterType } from '../filter-type.enum';

export class Bathrooms extends Filter {
  constructor() {
    super('Baños', 'div.item-form:has(input[name="adfilter_baths_1"])', FilterType.MULTIPLE_SELECTOR);
  }
}
