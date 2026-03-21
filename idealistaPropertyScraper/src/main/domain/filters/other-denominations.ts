import { Filter } from 'domain/filters/filter';
import { FilterType } from 'domain/filters/filter-type';

export class OtherDenominations extends Filter {
  constructor() {
    super('Otras denominaciones', 'div.item-form:has(#otherDenominationsGroup)', FilterType.MULTIPLE_SELECTOR);
  }
}
