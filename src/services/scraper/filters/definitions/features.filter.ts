import { Filter } from '../filter.interface';
import { FilterType } from '../filter-type.enum';

export class Features implements Filter {
  getName(): string {
    return 'Características';
  }

  getType(): FilterType {
    return FilterType.MULTIPLE_SELECTOR;
  }

  getCssSelector(): string {
    return 'div.item-form:has(input[name="adfilter_housingpetsallowed"])';
  }
}
