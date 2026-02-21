import { Filter } from '../filter.interface';
import { FilterType } from '../filter-type.enum';

export class Size implements Filter {
  getName(): string {
    return 'Tamaño';
  }

  getType(): FilterType {
    return FilterType.MIN_MAX;
  }

  getCssSelector(): string {
    return '#area-filter-container';
  }
}
