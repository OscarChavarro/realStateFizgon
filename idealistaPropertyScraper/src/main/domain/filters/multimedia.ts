import { Filter } from 'domain/filters/filter';
import { FilterType } from 'domain/filters/filter-type';

export class Multimedia extends Filter {
  constructor() {
    super('Multimedia', 'div.item-form:has(input[name="adfilter_hasplan"])', FilterType.MULTIPLE_SELECTOR);
  }
}
