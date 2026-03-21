import { Filter } from 'domain/filters/filter';
import { FILTER_IDS } from 'domain/filters/filter-id';
import { FilterType } from 'domain/filters/filter-type';

export class HousingType extends Filter {
  constructor() {
    super(FILTER_IDS.HOUSING_TYPE, 'Tipo de vivienda', 'div.item-form:has(input[data-qa="adfilter_homes"])', FilterType.MULTIPLE_SELECTOR);
  }
}
