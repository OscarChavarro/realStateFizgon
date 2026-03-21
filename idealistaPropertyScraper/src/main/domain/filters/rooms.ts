import { Filter } from 'domain/filters/filter';
import { FILTER_IDS } from 'domain/filters/filter-id';
import { FilterType } from 'domain/filters/filter-type';

export class Rooms extends Filter {
  constructor() {
    super(FILTER_IDS.ROOMS, 'Habitaciones', 'div.item-form:has(input[name="adfilter_rooms_0"])', FilterType.MULTIPLE_SELECTOR);
  }
}
