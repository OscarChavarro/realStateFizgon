import { Filter } from 'domain/filters/filter';
import { FILTER_IDS } from 'domain/filters/filter-id';
import { FilterType } from 'domain/filters/filter-type';

export class PropertyType extends Filter {
  constructor() {
    super(FILTER_IDS.PROPERTY_TYPE, 'Tipo de inmueble', '#filter-form > .item-form.typology-filter-container', FilterType.SINGLE_SELECTOR_DROPDOWN);
  }
}
