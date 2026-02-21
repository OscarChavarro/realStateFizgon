import { Filter } from '../filter.interface';
import { FilterType } from '../filter-type.enum';

export class Size implements Filter {
  private plainOptions: string[] = [];
  getName(): string {
    return 'Tamaño';
  }

  getType(): FilterType {
    return FilterType.MIN_MAX;
  }

  setPlainOptions(options: string[]): void {
    this.plainOptions = [...options];
  }

  getCssSelector(): string {
    return '#area-filter-container';
  }
}
