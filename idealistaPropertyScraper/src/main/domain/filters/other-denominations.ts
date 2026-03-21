import { Filter } from 'domain/filters/filter';
import { FILTER_IDS } from 'domain/filters/filter-id';
import { FilterType } from 'domain/filters/filter-type';

export class OtherDenominations extends Filter {
  constructor() {
    super(FILTER_IDS.OTHER_DENOMINATIONS, 'Otras denominaciones', 'div.item-form:has(#otherDenominationsGroup)', FilterType.MULTIPLE_SELECTOR);
  }
}
