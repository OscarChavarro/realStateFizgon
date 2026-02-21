import { Filter } from '../filter.interface';
import { FilterType } from '../filter-type.enum';

export class Multimedia extends Filter {
  constructor() {
    super('Multimedia', 'div.item-form:has(input[name="adfilter_hasplan"])', FilterType.MULTIPLE_SELECTOR);
  }
}
