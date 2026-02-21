import { Filter } from '../filter.interface';
import { FilterType } from '../filter-type.enum';

export class Equipment implements Filter {
  private plainOptions: string[] = [];
  getName(): string {
    return 'Equipamiento';
  }

  getType(): FilterType {
    return FilterType.SINGLE_SELECTOR_DROPDOWN;
  }

  setPlainOptions(options: string[]): void {
    this.plainOptions = [...options];
  }

  getCssSelector(): string {
    return 'div.item-form:has(#qa_adfilter_amenity)';
  }
}
