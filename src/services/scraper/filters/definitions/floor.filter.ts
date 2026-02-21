import { Filter } from '../filter.interface';
import { FilterType } from '../filter-type.enum';

export class Floor implements Filter {
  getName(): string {
    return 'Planta';
  }

  getType(): FilterType {
    return FilterType.MULTIPLE_SELECTOR;
  }

  getCssSelector(): string {
    return 'div.item-form:has(input[name="adfilter_top_floor"])';
  }
}
