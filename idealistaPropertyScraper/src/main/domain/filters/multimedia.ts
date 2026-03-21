import { Filter } from 'domain/filters/filter';
import { FILTER_IDS } from 'domain/filters/filter-id';
import { FilterType } from 'domain/filters/filter-type';

export class Multimedia extends Filter {
  constructor() {
    super(FILTER_IDS.MULTIMEDIA, 'Multimedia', 'div.item-form:has(input[name="adfilter_hasplan"])', FilterType.MULTIPLE_SELECTOR);
  }
}
