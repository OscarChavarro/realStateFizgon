import { Filter } from '../filter.interface';

export class Condition implements Filter {
  name(): string {
    return 'Estado';
  }

  cssSelector(): string {
    return 'div.item-form:has(input[name="adfilter_newconstruction"])';
  }
}
