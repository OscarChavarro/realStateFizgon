import { Filter } from 'src/domain/filters/filter';
import { FilterType } from 'src/domain/filters/filter-type.enum';

export class RentalType extends Filter {
  constructor() {
    super('Tipo de alquiler', 'div.item-form:has(input[name="adfilter_longTermRental"])', FilterType.MULTIPLE_SELECTOR);
  }
}
