import { Filter } from 'src/services/scraper/filters/filter.interface';
import { FilterType } from 'src/model/filters/filter-type.enum';

export class PropertyType extends Filter {
  constructor() {
    super('Tipo de inmueble', '#filter-form > .item-form.typology-filter-container', FilterType.SINGLE_SELECTOR_DROPDOWN);
  }
}
