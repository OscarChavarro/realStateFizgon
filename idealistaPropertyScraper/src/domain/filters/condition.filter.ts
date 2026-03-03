import { Filter } from 'src/application/services/scraper/filters/filter.interface';
import { FilterType } from 'src/domain/filters/filter-type.enum';

export class Condition extends Filter {
  constructor() {
    super('Estado', 'div.item-form:has(input[name="adfilter_newconstruction"])', FilterType.MULTIPLE_SELECTOR);
  }
}
