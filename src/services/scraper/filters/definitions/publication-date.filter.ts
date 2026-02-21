import { Filter } from '../filter.interface';
import { FilterType } from '../filter-type.enum';

export class PublicationDate implements Filter {
  getName(): string {
    return 'Fecha de publicación';
  }

  getType(): FilterType {
    return FilterType.SINGLE_SELECTOR;
  }

  getCssSelector(): string {
    return 'fieldset.item-form.publication-date';
  }
}
