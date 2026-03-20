import { Filter } from 'domain/filters/filter';
import { FilterType } from 'domain/filters/filter-type.enum';

export class EnergyEfficiency extends Filter {
  constructor() {
    super('Eficiencia Energética', 'div.item-form:has(input[name="adfilter_energyCertificateHigh"])', FilterType.MULTIPLE_SELECTOR);
  }
}
