import { Filter } from '../filter.interface';
import { FilterType } from '../filter-type.enum';

export class Equipment implements Filter {
  getName(): string {
    return 'Equipamiento';
  }

  getType(): FilterType {
    return FilterType.SINGLE_SELECTOR_DROPDOWN;
  }

  getCssSelector(): string {
    return 'div.item-form:has(#qa_adfilter_amenity)';
  }
}
