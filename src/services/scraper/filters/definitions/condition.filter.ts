import { Filter } from '../filter.interface';
import { FilterType } from '../filter-type.enum';

export class Condition implements Filter {
  getName(): string {
    return 'Estado';
  }

  getType(): FilterType {
    return FilterType.MULTIPLE_SELECTOR;
  }

  getCssSelector(): string {
    return 'div.item-form:has(input[name="adfilter_newconstruction"])';
  }
}
