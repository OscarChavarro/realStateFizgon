import { Filter } from 'domain/filters/filter';
import { FilterType } from 'domain/filters/filter-type';

export class Equipment extends Filter {
  constructor() {
    super(
      'Equipamiento',
      'div.item-form:has(#qa_adfilter_amenity), div.dropdown-list:has(#qa_adfilter_amenity)',
      FilterType.SINGLE_SELECTOR_DROPDOWN
    );
  }
}
