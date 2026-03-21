import { Filter } from 'domain/filters/filter';
import { FILTER_IDS } from 'domain/filters/filter-id';
import { FilterType } from 'domain/filters/filter-type';

export class Features extends Filter {
  constructor() {
    super(FILTER_IDS.FEATURES, 'Características', 'div.item-form:has(input[name="adfilter_housingpetsallowed"])', FilterType.MULTIPLE_SELECTOR);
  }
}
