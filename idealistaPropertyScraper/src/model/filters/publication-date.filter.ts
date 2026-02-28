import { Filter } from '../../services/scraper/filters/filter.interface';
import { FilterType } from './filter-type.enum';

export class PublicationDate extends Filter {
  constructor() {
    super('Fecha de publicación', 'fieldset.item-form.publication-date', FilterType.SINGLE_SELECTOR);
  }
}
