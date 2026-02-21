import { Filter } from '../filter.interface';
import { FilterType } from '../filter-type.enum';

export class Size extends Filter {
  constructor() {
    super('Tamaño', '#area-filter-container', FilterType.MIN_MAX);
  }
}
