import { Filter } from 'domain/filters/filter';
import { FilterType } from 'domain/filters/filter-type';

export class Size extends Filter {
  protected minOptions: string[] = [];
  protected maxOptions: string[] = [];

  constructor() {
    super('Tamaño', '#area-filter-container', FilterType.MIN_MAX);
  }

  setMinOptions(options: string[]): void {
    this.minOptions = [...options];
  }

  setMaxOptions(options: string[]): void {
    this.maxOptions = [...options];
  }
}
