import { Filter } from 'src/services/scraper/filters/filter.interface';
import { FilterType } from 'src/model/filters/filter-type.enum';

export class EnergyEfficiency extends Filter {
  constructor() {
    super('Eficiencia Energética', 'div.item-form:has(input[name="adfilter_energyCertificateHigh"])', FilterType.MULTIPLE_SELECTOR);
  }
}
