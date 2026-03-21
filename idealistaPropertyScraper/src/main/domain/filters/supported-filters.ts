import { Filter } from 'domain/filters/filter';
import { Bathrooms } from 'domain/filters/bathrooms';
import { Condition } from 'domain/filters/condition';
import { EnergyEfficiency } from 'domain/filters/energy-efficiency';
import { Equipment } from 'domain/filters/equipment';
import { Features } from 'domain/filters/features';
import { Floor } from 'domain/filters/floor';
import { HousingType } from 'domain/filters/housing-type';
import { ListingType } from 'domain/filters/listing-type';
import { Multimedia } from 'domain/filters/multimedia';
import { OtherDenominations } from 'domain/filters/other-denominations';
import { Price } from 'domain/filters/price';
import { PropertyType } from 'domain/filters/property-type';
import { PublicationDate } from 'domain/filters/publication-date';
import { RentalType } from 'domain/filters/rental-type';
import { Rooms } from 'domain/filters/rooms';
import { Size } from 'domain/filters/size';

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
