import { Filter } from '../filter.interface';
import { FilterType } from '../filter-type.enum';

export class PublicationDate implements Filter {
  private plainOptions: string[] = [];
  getName(): string {
    return 'Fecha de publicación';
  }

  getType(): FilterType {
    return FilterType.SINGLE_SELECTOR;
  }

  setPlainOptions(options: string[]): void {
    this.plainOptions = [...options];
  }

  getCssSelector(): string {
    return 'fieldset.item-form.publication-date';
  }
}
