import { FilterType } from './filter-type.enum';

export interface Filter {
  getName(): string;
  getCssSelector(): string;
  getType(): FilterType;
  setPlainOptions(options: string[]): void;
}
