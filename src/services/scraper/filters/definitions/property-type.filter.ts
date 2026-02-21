import { Filter } from '../filter.interface';
import { FilterType } from '../filter-type.enum';

export class PropertyType implements Filter {
  private plainOptions: string[] = [];
  getName(): string {
    return 'Tipo de inmueble';
  }

  getType(): FilterType {
    return FilterType.SINGLE_SELECTOR_DROPDOWN;
  }

  setPlainOptions(options: string[]): void {
    this.plainOptions = [...options];
  }

  getCssSelector(): string {
    return '#filter-form > .item-form.typology-filter-container';
  }
}
