import { Filter } from '../filter.interface';

export class Price implements Filter {
  name(): string {
    return 'Precio';
  }

  cssSelector(): string {
    return '#price-filter-container';
  }
}
