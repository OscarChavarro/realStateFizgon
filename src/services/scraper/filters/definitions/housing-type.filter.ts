import { Filter } from '../filter.interface';

export class HousingType implements Filter {
  name(): string {
    return 'Tipo de vivienda';
  }

  cssSelector(): string {
    return 'div.item-form:has(input[data-qa="adfilter_homes"])';
  }
}
