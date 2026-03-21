import { Filter } from 'domain/filters/filter';
import { FILTER_IDS } from 'domain/filters/filter-id';
import { FilterType } from 'domain/filters/filter-type';

export class EnergyEfficiency extends Filter {
  constructor() {
    super(FILTER_IDS.ENERGY_EFFICIENCY, 'Eficiencia Energética', 'div.item-form:has(input[name="adfilter_energyCertificateHigh"])', FilterType.MULTIPLE_SELECTOR);
  }
}
