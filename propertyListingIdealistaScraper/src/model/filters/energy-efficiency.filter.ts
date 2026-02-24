import { Filter } from '../../services/scraper/filters/filter.interface';
import { FilterType } from './filter-type.enum';

export class EnergyEfficiency extends Filter {
  constructor() {
    super('Eficiencia Energética', 'div.item-form:has(input[name="adfilter_energyCertificateHigh"])', FilterType.MULTIPLE_SELECTOR);
  }
}
