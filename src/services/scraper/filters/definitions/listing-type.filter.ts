import { Filter } from '../filter.interface';

export class ListingType implements Filter {
  name(): string {
    return 'Tipo de anuncio';
  }

  cssSelector(): string {
    return 'div.item-form:has(input[name="adfilter_agencyisabank"])';
  }
}
