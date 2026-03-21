import { Filter } from 'domain/filters/filter';
import { FILTER_IDS } from 'domain/filters/filter-id';
import { FilterType } from 'domain/filters/filter-type';

export class Floor extends Filter {
  constructor() {
    super(FILTER_IDS.FLOOR, 'Planta', 'div.item-form:has(input[name="adfilter_top_floor"])', FilterType.MULTIPLE_SELECTOR);
  }
}
