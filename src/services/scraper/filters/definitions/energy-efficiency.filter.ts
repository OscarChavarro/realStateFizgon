import { Filter } from '../filter.interface';
import { FilterType } from '../filter-type.enum';

export class EnergyEfficiency implements Filter {
  getName(): string {
    return 'Eficiencia Energética';
  }

  getType(): FilterType {
    return FilterType.MULTIPLE_SELECTOR;
  }

  getCssSelector(): string {
    return 'div.item-form:has(input[name="adfilter_energyCertificateHigh"])';
  }
}
