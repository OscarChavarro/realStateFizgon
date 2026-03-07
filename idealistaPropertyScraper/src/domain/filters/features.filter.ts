import { Filter } from 'src/domain/filters/filter';
import { FilterType } from 'src/domain/filters/filter-type.enum';

export class Features extends Filter {
  constructor() {
    super('Características', 'div.item-form:has(input[name="adfilter_housingpetsallowed"])', FilterType.MULTIPLE_SELECTOR);
  }
}
