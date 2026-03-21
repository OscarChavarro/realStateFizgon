import { Filter } from 'domain/filters/filter';
import { FilterType } from 'domain/filters/filter-type';

export class PropertyType extends Filter {
  constructor() {
    super('Tipo de inmueble', '#filter-form > .item-form.typology-filter-container', FilterType.SINGLE_SELECTOR_DROPDOWN);
  }
}
