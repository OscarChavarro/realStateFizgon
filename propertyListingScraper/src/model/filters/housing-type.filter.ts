import { Filter } from '../../services/scraper/filters/filter.interface';
import { FilterType } from './filter-type.enum';

export class HousingType extends Filter {
  constructor() {
    super('Tipo de vivienda', 'div.item-form:has(input[data-qa="adfilter_homes"])', FilterType.MULTIPLE_SELECTOR);
  }
}
