import { Filter } from '../filter.interface';

export class Bathrooms implements Filter {
  name(): string {
    return 'Baños';
  }

  cssSelector(): string {
    return 'div.item-form:has(input[name="adfilter_baths_1"])';
  }
}
