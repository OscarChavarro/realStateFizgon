import { Filter } from '../filter.interface';
import { FilterType } from '../filter-type.enum';

export class Price implements Filter {
  getName(): string {
    return 'Precio';
  }

  getType(): FilterType {
    return FilterType.MIN_MAX;
  }

  getCssSelector(): string {
    return '#price-filter-container';
  }
}
