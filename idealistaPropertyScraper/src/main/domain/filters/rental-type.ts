import { Filter } from 'domain/filters/filter';
import { FILTER_IDS } from 'domain/filters/filter-id';
import { FilterType } from 'domain/filters/filter-type';

export class RentalType extends Filter {
  constructor() {
    super(FILTER_IDS.RENTAL_TYPE, 'Tipo de alquiler', 'div.item-form:has(input[name="adfilter_longTermRental"])', FilterType.MULTIPLE_SELECTOR);
  }
}
