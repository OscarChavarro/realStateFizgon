import { Filter } from '../filter.interface';

export class Size implements Filter {
  name(): string {
    return 'Tamaño';
  }

  cssSelector(): string {
    return '#area-filter-container';
  }
}
