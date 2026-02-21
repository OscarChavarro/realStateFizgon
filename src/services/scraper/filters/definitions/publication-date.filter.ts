import { Filter } from '../filter.interface';

export class PublicationDate implements Filter {
  name(): string {
    return 'Fecha de publicación';
  }

  cssSelector(): string {
    return 'fieldset.item-form.publication-date';
  }
}
