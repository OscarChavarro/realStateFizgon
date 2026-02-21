import { Filter } from '../filter.interface';
import { FilterType } from '../filter-type.enum';

export class Equipment extends Filter {
  constructor() {
    super('Equipamiento', 'div.item-form:has(#qa_adfilter_amenity)', FilterType.SINGLE_SELECTOR_DROPDOWN);
  }
}
