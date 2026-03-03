import { Filter } from 'src/application/services/scraper/filters/filter.interface';
import { FilterType } from 'src/domain/filters/filter-type.enum';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

  loadFromConfiguration(): SupportedFilters {
    const configuration = this.readConfiguration();
    const definitions = this.flattenDefinitions(configuration?.filters?.definitions ?? []);

    for (const filter of this.supportedFilters) {
      const definitionKey = this.getDefinitionKey(filter.getName());
      const definition = definitionKey ? definitions[definitionKey] : undefined;
      if (!definition || typeof definition !== 'object') {
        continue;
      }

      if (filter.getType() === FilterType.MIN_MAX) {
        const minOptions = Array.isArray(definition.minOptions)
          ? definition.minOptions.filter((value): value is string => typeof value === 'string')
          : [];
        const maxOptions = Array.isArray(definition.maxOptions)
          ? definition.maxOptions.filter((value): value is string => typeof value === 'string')
          : [];
        filter.setMinOptions(minOptions);
        filter.setMaxOptions(maxOptions);
        filter.setSelectedMin(typeof definition.selectedMin === 'string' ? definition.selectedMin : null);
        filter.setSelectedMax(typeof definition.selectedMax === 'string' ? definition.selectedMax : null);
      } else {
        const plainOptions = Array.isArray(definition.plainOptions)
          ? definition.plainOptions.filter((value): value is string => typeof value === 'string')
          : [];
        filter.setPlainOptions(plainOptions);
        const selectedPlainOptions = Array.isArray(definition.selectedPlainOptions)
          ? definition.selectedPlainOptions.filter((value): value is string => typeof value === 'string')
          : [];
        filter.setSelectedPlainOptions(selectedPlainOptions);
      }
    }

    return this;
  }

  private readConfiguration(): {
    filters?: {
      definitions?: Array<Record<string, {
        plainOptions?: unknown[];
        minOptions?: unknown[];
        maxOptions?: unknown[];
        selectedPlainOptions?: unknown[];
        selectedMin?: unknown;
        selectedMax?: unknown;
      }>>;
    };
  } | null {
    try {
      const raw = readFileSync(join(process.cwd(), 'environment.json'), 'utf-8');
      return JSON.parse(raw) as {
        filters?: {
          definitions?: Array<Record<string, {
            plainOptions?: unknown[];
            minOptions?: unknown[];
            maxOptions?: unknown[];
            selectedPlainOptions?: unknown[];
            selectedMin?: unknown;
            selectedMax?: unknown;
          }>>;
        };
      };
    } catch {
      return null;
    }
  }

  private flattenDefinitions(
    definitions: Array<Record<string, {
      plainOptions?: unknown[];
      minOptions?: unknown[];
      maxOptions?: unknown[];
      selectedPlainOptions?: unknown[];
      selectedMin?: unknown;
      selectedMax?: unknown;
    }>>
  ): Record<string, {
    plainOptions?: unknown[];
    minOptions?: unknown[];
    maxOptions?: unknown[];
    selectedPlainOptions?: unknown[];
    selectedMin?: unknown;
    selectedMax?: unknown;
  }> {
    const accumulator: Record<string, {
      plainOptions?: unknown[];
      minOptions?: unknown[];
      maxOptions?: unknown[];
      selectedPlainOptions?: unknown[];
      selectedMin?: unknown;
      selectedMax?: unknown;
    }> = {};

    for (const entry of definitions) {
      const key = Object.keys(entry)[0];
      if (!key) {
        continue;
      }
      accumulator[key] = entry[key];
    }

    return accumulator;
  }

  private getDefinitionKey(filterName: string): string | null {
    const map: Record<string, string> = {
      'Tipo de inmueble': 'propertyType',
      'Precio': 'price',
      'Tipo de alquiler': 'rentalType',
      'Tamaño': 'size',
      'Tipo de vivienda': 'housingType',
      'Otras denominaciones': 'otherDenominations',
      Equipamiento: 'equipment',
      Habitaciones: 'rooms',
      'Baños': 'bathrooms',
      Estado: 'condition',
      'Características': 'features',
      Planta: 'floor',
      'Eficiencia Energética': 'energyEfficiency',
      Multimedia: 'multimedia',
      'Tipo de anuncio': 'listingType',
      'Fecha de publicación': 'publicationDate'
    };

    return map[filterName] ?? null;
  }
}
