import { Filter } from '../filter.interface';

export class EnergyEfficiency implements Filter {
  name(): string {
    return 'Eficiencia Energética';
  }

  cssSelector(): string {
    return 'div.item-form:has(input[name="adfilter_energyCertificateHigh"])';
  }
}
