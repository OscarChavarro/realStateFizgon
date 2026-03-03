import { Filter } from 'src/services/scraper/filters/filter.interface';
import { FilterType } from 'src/model/filters/filter-type.enum';

export class Rooms extends Filter {
  constructor() {
    super('Habitaciones', 'div.item-form:has(input[name="adfilter_rooms_0"])', FilterType.MULTIPLE_SELECTOR);
  }
}
