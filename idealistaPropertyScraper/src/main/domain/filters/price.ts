import { Filter } from 'domain/filters/filter';
import { FilterType } from 'domain/filters/filter-type';

export class Price extends Filter {
  protected minOptions: string[] = [];
  protected maxOptions: string[] = [];

  constructor() {
    super('Precio', '#price-filter-container', FilterType.MIN_MAX);
  }

  setMinOptions(options: string[]): void {
    this.minOptions = [...options];
  }

  setMaxOptions(options: string[]): void {
    this.maxOptions = [...options];
  }
}
