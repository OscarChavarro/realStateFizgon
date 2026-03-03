import { Filter } from 'src/services/scraper/filters/filter.interface';
import { FilterType } from 'src/model/filters/filter-type.enum';

export class OtherDenominations extends Filter {
  constructor() {
    super('Otras denominaciones', 'div.item-form:has(#otherDenominationsGroup)', FilterType.MULTIPLE_SELECTOR);
  }
}
