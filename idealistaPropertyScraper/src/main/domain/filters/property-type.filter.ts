import { Filter } from 'src/domain/filters/filter';
import { FilterType } from 'src/domain/filters/filter-type.enum';

export class PropertyType extends Filter {
  constructor() {
    super('Tipo de inmueble', '#filter-form > .item-form.typology-filter-container', FilterType.SINGLE_SELECTOR_DROPDOWN);
  }
}
