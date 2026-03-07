import { Filter } from 'src/domain/filters/filter';
import { FilterType } from 'src/domain/filters/filter-type.enum';

export class Rooms extends Filter {
  constructor() {
    super('Habitaciones', 'div.item-form:has(input[name="adfilter_rooms_0"])', FilterType.MULTIPLE_SELECTOR);
  }
}
