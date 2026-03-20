import { Filter } from 'domain/filters/filter';
import { FilterType } from 'domain/filters/filter-type.enum';

export class Floor extends Filter {
  constructor() {
    super('Planta', 'div.item-form:has(input[name="adfilter_top_floor"])', FilterType.MULTIPLE_SELECTOR);
  }
}
