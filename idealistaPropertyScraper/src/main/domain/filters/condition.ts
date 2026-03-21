import { Filter } from 'domain/filters/filter';
import { FILTER_IDS } from 'domain/filters/filter-id';
import { FilterType } from 'domain/filters/filter-type';

export class Condition extends Filter {
  constructor() {
    super(FILTER_IDS.CONDITION, 'Estado', 'div.item-form:has(input[name="adfilter_newconstruction"])', FilterType.MULTIPLE_SELECTOR);
  }
}
