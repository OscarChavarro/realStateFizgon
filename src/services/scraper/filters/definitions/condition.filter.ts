import { Filter } from '../filter.interface';
import { FilterType } from '../filter-type.enum';

export class Condition implements Filter {
  private plainOptions: string[] = [];
  getName(): string {
    return 'Estado';
  }

  getType(): FilterType {
    return FilterType.MULTIPLE_SELECTOR;
  }

  setPlainOptions(options: string[]): void {
    this.plainOptions = [...options];
  }

  getCssSelector(): string {
    return 'div.item-form:has(input[name="adfilter_newconstruction"])';
  }
}
