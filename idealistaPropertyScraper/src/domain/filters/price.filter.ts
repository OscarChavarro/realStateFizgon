import { Filter } from 'src/application/services/scraper/filters/filter.interface';
import { FilterType } from 'src/domain/filters/filter-type.enum';

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
