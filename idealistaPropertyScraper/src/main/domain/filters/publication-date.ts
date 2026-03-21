import { Filter } from 'domain/filters/filter';
import { FilterType } from 'domain/filters/filter-type';

export class PublicationDate extends Filter {
  constructor() {
    super('Fecha de publicación', 'fieldset.item-form.publication-date', FilterType.SINGLE_SELECTOR);
  }
}
