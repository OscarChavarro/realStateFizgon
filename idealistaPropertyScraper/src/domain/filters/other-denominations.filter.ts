import { Filter } from 'src/application/services/scraper/filters/filter.interface';
import { FilterType } from 'src/domain/filters/filter-type.enum';

export class OtherDenominations extends Filter {
  constructor() {
    super('Otras denominaciones', 'div.item-form:has(#otherDenominationsGroup)', FilterType.MULTIPLE_SELECTOR);
  }
}
