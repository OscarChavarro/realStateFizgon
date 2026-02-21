import { Filter } from '../filter.interface';
import { FilterType } from '../filter-type.enum';

export class HousingType implements Filter {
  private plainOptions: string[] = [];
  getName(): string {
    return 'Tipo de vivienda';
  }

  getType(): FilterType {
    return FilterType.MULTIPLE_SELECTOR;
  }

  setPlainOptions(options: string[]): void {
    this.plainOptions = [...options];
  }

  getCssSelector(): string {
    return 'div.item-form:has(input[data-qa="adfilter_homes"])';
  }
}
