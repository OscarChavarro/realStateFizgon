import { Filter } from '../../services/scraper/filters/filter.interface';
import { FilterType } from './filter-type.enum';

export class OtherDenominations extends Filter {
  constructor() {
    super('Otras denominaciones', 'div.item-form:has(#otherDenominationsGroup)', FilterType.MULTIPLE_SELECTOR);
  }
}
