import { Filter } from '../filter.interface';

export class OtherDenominations implements Filter {
  name(): string {
    return 'Otras denominaciones';
  }

  cssSelector(): string {
    return 'div.item-form:has(#otherDenominationsGroup)';
  }
}
