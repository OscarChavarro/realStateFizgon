import { Filter } from '../filter.interface';

export class Rooms implements Filter {
  name(): string {
    return 'Habitaciones';
  }

  cssSelector(): string {
    return 'div.item-form:has(input[name="adfilter_rooms_0"])';
  }
}
