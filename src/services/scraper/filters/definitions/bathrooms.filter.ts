import { Filter } from '../filter.interface';
import { FilterType } from '../filter-type.enum';

export class Bathrooms implements Filter {
  getName(): string {
    return 'Baños';
  }

  getType(): FilterType {
    return FilterType.MULTIPLE_SELECTOR;
  }

  getCssSelector(): string {
    return 'div.item-form:has(input[name="adfilter_baths_1"])';
  }
}
