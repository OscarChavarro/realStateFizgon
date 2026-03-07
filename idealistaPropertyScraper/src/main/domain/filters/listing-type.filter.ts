import { Filter } from 'src/domain/filters/filter';
import { FilterType } from 'src/domain/filters/filter-type.enum';

export class ListingType extends Filter {
  constructor() {
    super('Tipo de anuncio', 'div.item-form:has(input[name="adfilter_agencyisabank"])', FilterType.MULTIPLE_SELECTOR);
  }
}
