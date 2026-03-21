import { Filter } from 'domain/filters/filter';
import { FilterType } from 'domain/filters/filter-type';

export class RentalType extends Filter {
  constructor() {
    super('Tipo de alquiler', 'div.item-form:has(input[name="adfilter_longTermRental"])', FilterType.MULTIPLE_SELECTOR);
  }
}
