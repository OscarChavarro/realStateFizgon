import { Filter } from 'src/application/services/scraper/filters/filter.interface';
import { Bathrooms } from 'src/domain/filters/bathrooms.filter';
import { Condition } from 'src/domain/filters/condition.filter';
import { EnergyEfficiency } from 'src/domain/filters/energy-efficiency.filter';
import { Equipment } from 'src/domain/filters/equipment.filter';
import { Features } from 'src/domain/filters/features.filter';
import { Floor } from 'src/domain/filters/floor.filter';
import { HousingType } from 'src/domain/filters/housing-type.filter';
import { ListingType } from 'src/domain/filters/listing-type.filter';
import { Multimedia } from 'src/domain/filters/multimedia.filter';
import { OtherDenominations } from 'src/domain/filters/other-denominations.filter';
import { Price } from 'src/domain/filters/price.filter';
import { PropertyType } from 'src/domain/filters/property-type.filter';
import { PublicationDate } from 'src/domain/filters/publication-date.filter';
import { RentalType } from 'src/domain/filters/rental-type.filter';
import { Rooms } from 'src/domain/filters/rooms.filter';
import { Size } from 'src/domain/filters/size.filter';

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
