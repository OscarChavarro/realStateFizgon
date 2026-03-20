import { Filter } from 'domain/filters/filter';
import { FilterType } from 'domain/filters/filter-type.enum';

export class Features extends Filter {
  constructor() {
    super('Características', 'div.item-form:has(input[name="adfilter_housingpetsallowed"])', FilterType.MULTIPLE_SELECTOR);
  }
}
