import { Filter } from '../filter.interface';
import { FilterType } from '../filter-type.enum';

export class Features extends Filter {
  constructor() {
    super('Características', 'div.item-form:has(input[name="adfilter_housingpetsallowed"])', FilterType.MULTIPLE_SELECTOR);
  }
}
