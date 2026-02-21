import { Filter } from '../filter.interface';
import { FilterType } from '../filter-type.enum';

export class Rooms implements Filter {
  getName(): string {
    return 'Habitaciones';
  }

  getType(): FilterType {
    return FilterType.MULTIPLE_SELECTOR;
  }

  getCssSelector(): string {
    return 'div.item-form:has(input[name="adfilter_rooms_0"])';
  }
}
