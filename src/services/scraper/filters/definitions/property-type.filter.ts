import { Filter } from '../filter.interface';
import { FilterType } from '../filter-type.enum';

export class PropertyType implements Filter {
  getName(): string {
    return 'Tipo de inmueble';
  }

  getType(): FilterType {
    return FilterType.SINGLE_SELECTOR_DROPDOWN;
  }

  getCssSelector(): string {
    return '#filter-form > .item-form.typology-filter-container';
  }
}
