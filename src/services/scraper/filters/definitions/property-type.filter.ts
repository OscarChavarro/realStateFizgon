import { Filter } from '../filter.interface';

export class PropertyType implements Filter {
  name(): string {
    return 'Tipo de inmueble';
  }

  cssSelector(): string {
    return '#filter-form > .item-form.typology-filter-container';
  }
}
