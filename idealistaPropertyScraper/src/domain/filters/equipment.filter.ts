import { Filter } from 'src/application/services/scraper/filters/filter.interface';
import { FilterType } from 'src/domain/filters/filter-type.enum';

export class Equipment extends Filter {
  constructor() {
    super(
      'Equipamiento',
      'div.item-form:has(#qa_adfilter_amenity), div.dropdown-list:has(#qa_adfilter_amenity)',
      FilterType.SINGLE_SELECTOR_DROPDOWN
    );
  }
}
