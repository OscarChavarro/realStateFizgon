import { Filter } from '../filter.interface';
import { FilterType } from '../filter-type.enum';

export class Price implements Filter {
  private plainOptions: string[] = [];
  getName(): string {
    return 'Precio';
  }

  getType(): FilterType {
    return FilterType.MIN_MAX;
  }

  setPlainOptions(options: string[]): void {
    this.plainOptions = [...options];
  }

  getCssSelector(): string {
    return '#price-filter-container';
  }
}
