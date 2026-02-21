import { Filter } from '../filter.interface';

export class Equipment implements Filter {
  name(): string {
    return 'Equipamiento';
  }

  cssSelector(): string {
    return 'div.item-form:has(#qa_adfilter_amenity)';
  }
}
