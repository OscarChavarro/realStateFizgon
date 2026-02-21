import { Filter } from '../filter.interface';

export class Features implements Filter {
  name(): string {
    return 'Características';
  }

  cssSelector(): string {
    return 'div.item-form:has(input[name="adfilter_housingpetsallowed"])';
  }
}
