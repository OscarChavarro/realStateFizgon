import { Filter } from '../filter.interface';
import { FilterType } from '../filter-type.enum';

export class ListingType implements Filter {
  private plainOptions: string[] = [];
  getName(): string {
    return 'Tipo de anuncio';
  }

  getType(): FilterType {
    return FilterType.MULTIPLE_SELECTOR;
  }

  setPlainOptions(options: string[]): void {
    this.plainOptions = [...options];
  }

  getCssSelector(): string {
    return 'div.item-form:has(input[name="adfilter_agencyisabank"])';
  }
}
