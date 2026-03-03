import { Filter } from 'src/application/services/scraper/filters/filter.interface';
import { FilterType } from 'src/domain/filters/filter-type.enum';

export class RentalType extends Filter {
  constructor() {
    super('Tipo de alquiler', 'div.item-form:has(input[name="adfilter_longTermRental"])', FilterType.MULTIPLE_SELECTOR);
  }
}
