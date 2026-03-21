import { Filter } from 'domain/filters/filter';
import { FILTER_IDS } from 'domain/filters/filter-id';
import { FilterType } from 'domain/filters/filter-type';

export class Equipment extends Filter {
  constructor() {
    super(
      FILTER_IDS.EQUIPMENT,
      'Equipamiento',
      'div.item-form:has(#qa_adfilter_amenity), div.dropdown-list:has(#qa_adfilter_amenity)',
      FilterType.SINGLE_SELECTOR_DROPDOWN
    );
  }
}
