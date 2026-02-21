import { Filter } from '../filter.interface';

export class RentalType implements Filter {
  name(): string {
    return 'Tipo de alquiler';
  }

  cssSelector(): string {
    return 'div.item-form:has(input[name="adfilter_longTermRental"])';
  }
}
