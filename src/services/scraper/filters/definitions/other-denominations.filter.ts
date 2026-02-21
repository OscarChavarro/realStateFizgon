import { Filter } from '../filter.interface';
import { FilterType } from '../filter-type.enum';

export class OtherDenominations implements Filter {
  getName(): string {
    return 'Otras denominaciones';
  }

  getType(): FilterType {
    return FilterType.MULTIPLE_SELECTOR;
  }

  getCssSelector(): string {
    return 'div.item-form:has(#otherDenominationsGroup)';
  }
}
