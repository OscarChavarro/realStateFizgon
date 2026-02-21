import { Filter } from './filter.interface';
import { Bathrooms } from './definitions/bathrooms.filter';
import { Condition } from './definitions/condition.filter';
import { EnergyEfficiency } from './definitions/energy-efficiency.filter';
import { Equipment } from './definitions/equipment.filter';
import { Features } from './definitions/features.filter';
import { Floor } from './definitions/floor.filter';
import { HousingType } from './definitions/housing-type.filter';
import { ListingType } from './definitions/listing-type.filter';
import { Multimedia } from './definitions/multimedia.filter';
import { OtherDenominations } from './definitions/other-denominations.filter';
import { Price } from './definitions/price.filter';
import { PropertyType } from './definitions/property-type.filter';
import { PublicationDate } from './definitions/publication-date.filter';
import { RentalType } from './definitions/rental-type.filter';
import { Rooms } from './definitions/rooms.filter';
import { Size } from './definitions/size.filter';

export const SUPPORTED_FILTERS: Filter[] = [
  new PropertyType(),
  new Price(),
  new RentalType(),
  new Size(),
  new HousingType(),
  new OtherDenominations(),
  new Equipment(),
  new Rooms(),
  new Bathrooms(),
  new Condition(),
  new Features(),
  new Floor(),
  new EnergyEfficiency(),
  new Multimedia(),
  new ListingType(),
  new PublicationDate()
];
