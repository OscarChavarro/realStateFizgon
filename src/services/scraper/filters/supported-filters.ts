import { Filter } from './filter.interface';
import { FilterType } from './filter-type.enum';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
