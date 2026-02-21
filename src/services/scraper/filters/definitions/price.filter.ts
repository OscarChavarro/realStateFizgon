import { Filter } from '../filter.interface';
import { FilterType } from '../filter-type.enum';

export class Price extends Filter {
  constructor() {
    super('Precio', '#price-filter-container', FilterType.MIN_MAX);
  }
}
