import { Filter } from 'src/domain/filters/filter';
import { FilterType } from 'src/domain/filters/filter-type.enum';

export class PublicationDate extends Filter {
  constructor() {
    super('Fecha de publicación', 'fieldset.item-form.publication-date', FilterType.SINGLE_SELECTOR);
  }
}
