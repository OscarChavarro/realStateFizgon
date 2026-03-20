import { Filter } from 'domain/filters/filter';
import { Bathrooms } from 'domain/filters/bathrooms.filter';
import { Condition } from 'domain/filters/condition.filter';
import { EnergyEfficiency } from 'domain/filters/energy-efficiency.filter';
import { Equipment } from 'domain/filters/equipment.filter';
import { Features } from 'domain/filters/features.filter';
import { Floor } from 'domain/filters/floor.filter';
import { HousingType } from 'domain/filters/housing-type.filter';
import { ListingType } from 'domain/filters/listing-type.filter';
import { Multimedia } from 'domain/filters/multimedia.filter';
import { OtherDenominations } from 'domain/filters/other-denominations.filter';
import { Price } from 'domain/filters/price.filter';
import { PropertyType } from 'domain/filters/property-type.filter';
import { PublicationDate } from 'domain/filters/publication-date.filter';
import { RentalType } from 'domain/filters/rental-type.filter';
import { Rooms } from 'domain/filters/rooms.filter';
import { Size } from 'domain/filters/size.filter';

export class SupportedFilters {
  private readonly supportedFilters: Filter[] = [
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

  getSupportedFilters(): Filter[] {
    return this.supportedFilters;
  }
}
