import { Filter } from 'domain/filters/filter';
import { FilterType } from 'domain/filters/filter-type.enum';

export class HousingType extends Filter {
  constructor() {
    super('Tipo de vivienda', 'div.item-form:has(input[data-qa="adfilter_homes"])', FilterType.MULTIPLE_SELECTOR);
  }
}
