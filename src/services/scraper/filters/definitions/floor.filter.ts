import { Filter } from '../filter.interface';

export class Floor implements Filter {
  name(): string {
    return 'Planta';
  }

  cssSelector(): string {
    return 'div.item-form:has(input[name="adfilter_top_floor"])';
  }
}
