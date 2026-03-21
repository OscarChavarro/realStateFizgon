import { Filter } from 'domain/filters/filter';
import { FilterType } from 'domain/filters/filter-type';

export class Rooms extends Filter {
  constructor() {
    super('Habitaciones', 'div.item-form:has(input[name="adfilter_rooms_0"])', FilterType.MULTIPLE_SELECTOR);
  }
}
