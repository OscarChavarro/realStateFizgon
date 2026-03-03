import { Filter } from 'src/application/services/scraper/filters/filter.interface';
import { FilterType } from 'src/domain/filters/filter-type.enum';

export class Multimedia extends Filter {
  constructor() {
    super('Multimedia', 'div.item-form:has(input[name="adfilter_hasplan"])', FilterType.MULTIPLE_SELECTOR);
  }
}
