import { Filter } from '../filter.interface';
import { FilterType } from '../filter-type.enum';

export class HousingType implements Filter {
  getName(): string {
    return 'Tipo de vivienda';
  }

  getType(): FilterType {
    return FilterType.MULTIPLE_SELECTOR;
  }

  getCssSelector(): string {
    return 'div.item-form:has(input[data-qa="adfilter_homes"])';
  }
}
