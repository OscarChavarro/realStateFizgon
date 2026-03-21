import { Filter } from 'domain/filters/filter';
import { FILTER_IDS } from 'domain/filters/filter-id';
import { FilterType } from 'domain/filters/filter-type';

export class PublicationDate extends Filter {
  constructor() {
    super(FILTER_IDS.PUBLICATION_DATE, 'Fecha de publicación', 'fieldset.item-form.publication-date', FilterType.SINGLE_SELECTOR);
  }
}
