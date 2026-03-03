import { Filter } from 'src/services/scraper/filters/filter.interface';
import { FilterType } from 'src/model/filters/filter-type.enum';

export class RentalType extends Filter {
  constructor() {
    super('Tipo de alquiler', 'div.item-form:has(input[name="adfilter_longTermRental"])', FilterType.MULTIPLE_SELECTOR);
  }
}
