import { Filter } from '../filter.interface';

export class Multimedia implements Filter {
  name(): string {
    return 'Multimedia';
  }

  cssSelector(): string {
    return 'div.item-form:has(input[name="adfilter_hasplan"])';
  }
}
