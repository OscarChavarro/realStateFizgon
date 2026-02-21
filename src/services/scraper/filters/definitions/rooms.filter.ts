import { Filter } from '../filter.interface';
import { FilterType } from '../filter-type.enum';

export class Rooms extends Filter {
  constructor() {
    super('Habitaciones', 'div.item-form:has(input[name="adfilter_rooms_0"])', FilterType.MULTIPLE_SELECTOR);
  }
}
