import { describe, expect, it } from '@jest/globals';
import { Bathrooms } from 'domain/filters/bathrooms';
import { Condition } from 'domain/filters/condition';
import { EnergyEfficiency } from 'domain/filters/energy-efficiency';
import { Equipment } from 'domain/filters/equipment';
import { Features } from 'domain/filters/features';
import { Filter } from 'domain/filters/filter';
import { FILTER_IDS } from 'domain/filters/filter-id';
import { FilterType } from 'domain/filters/filter-type';
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
import { SupportedFilters } from 'domain/filters/supported-filters';

class NoopMinMaxFilter extends Filter {
  constructor() {
    super(FILTER_IDS.PRICE, 'Noop', '#noop', FilterType.MIN_MAX);
  }
}

describe('Filter definitions', () => {
  it.each([
    { factory: () => new Bathrooms(), id: FILTER_IDS.BATHROOMS, name: 'Baños', selector: 'div.item-form:has(input[name="adfilter_baths_1"])', type: FilterType.MULTIPLE_SELECTOR },
    { factory: () => new Condition(), id: FILTER_IDS.CONDITION, name: 'Estado', selector: 'div.item-form:has(input[name="adfilter_newconstruction"])', type: FilterType.MULTIPLE_SELECTOR },
    { factory: () => new EnergyEfficiency(), id: FILTER_IDS.ENERGY_EFFICIENCY, name: 'Eficiencia Energética', selector: 'div.item-form:has(input[name="adfilter_energyCertificateHigh"])', type: FilterType.MULTIPLE_SELECTOR },
    { factory: () => new Equipment(), id: FILTER_IDS.EQUIPMENT, name: 'Equipamiento', selector: 'div.item-form:has(#qa_adfilter_amenity), div.dropdown-list:has(#qa_adfilter_amenity)', type: FilterType.SINGLE_SELECTOR_DROPDOWN },
    { factory: () => new Features(), id: FILTER_IDS.FEATURES, name: 'Características', selector: 'div.item-form:has(input[name="adfilter_housingpetsallowed"])', type: FilterType.MULTIPLE_SELECTOR },
    { factory: () => new Floor(), id: FILTER_IDS.FLOOR, name: 'Planta', selector: 'div.item-form:has(input[name="adfilter_top_floor"])', type: FilterType.MULTIPLE_SELECTOR },
    { factory: () => new HousingType(), id: FILTER_IDS.HOUSING_TYPE, name: 'Tipo de vivienda', selector: 'div.item-form:has(input[data-qa="adfilter_homes"])', type: FilterType.MULTIPLE_SELECTOR },
    { factory: () => new ListingType(), id: FILTER_IDS.LISTING_TYPE, name: 'Tipo de anuncio', selector: 'div.item-form:has(input[name="adfilter_agencyisabank"])', type: FilterType.MULTIPLE_SELECTOR },
    { factory: () => new Multimedia(), id: FILTER_IDS.MULTIMEDIA, name: 'Multimedia', selector: 'div.item-form:has(input[name="adfilter_hasplan"])', type: FilterType.MULTIPLE_SELECTOR },
    { factory: () => new OtherDenominations(), id: FILTER_IDS.OTHER_DENOMINATIONS, name: 'Otras denominaciones', selector: 'div.item-form:has(#otherDenominationsGroup)', type: FilterType.MULTIPLE_SELECTOR },
    { factory: () => new Price(), id: FILTER_IDS.PRICE, name: 'Precio', selector: '#price-filter-container', type: FilterType.MIN_MAX },
    { factory: () => new PropertyType(), id: FILTER_IDS.PROPERTY_TYPE, name: 'Tipo de inmueble', selector: '#filter-form > .item-form.typology-filter-container', type: FilterType.SINGLE_SELECTOR_DROPDOWN },
    { factory: () => new PublicationDate(), id: FILTER_IDS.PUBLICATION_DATE, name: 'Fecha de publicación', selector: 'fieldset.item-form.publication-date', type: FilterType.SINGLE_SELECTOR },
    { factory: () => new RentalType(), id: FILTER_IDS.RENTAL_TYPE, name: 'Tipo de alquiler', selector: 'div.item-form:has(input[name="adfilter_longTermRental"])', type: FilterType.MULTIPLE_SELECTOR },
    { factory: () => new Rooms(), id: FILTER_IDS.ROOMS, name: 'Habitaciones', selector: 'div.item-form:has(input[name="adfilter_rooms_0"])', type: FilterType.MULTIPLE_SELECTOR },
    { factory: () => new Size(), id: FILTER_IDS.SIZE, name: 'Tamaño', selector: '#area-filter-container', type: FilterType.MIN_MAX }
  ])('whenFilterIsInstantiated_getters_shouldExposeStaticDefinition', ({ factory, id, name, selector, type }) => {
    // Arrange
    const filter = factory();
    // Action
    const values = { id: filter.getId(), name: filter.getName(), selector: filter.getCssSelector(), type: filter.getType() };
    // Assert
    expect(values).toEqual({ id, name, selector, type });
  });

  it('whenPlainOptionsAreSet_getSelectedPlainOptions_shouldReturnClonedValues', () => {
    // Arrange
    const filter = new Rooms();
    const selected = ['1', '2'];
    filter.setSelectedPlainOptions(selected);
    selected.push('3');
    // Action
    const result = filter.getSelectedPlainOptions();
    // Assert
    expect(result).toEqual(['1', '2']);
  });

  it('whenPlainOptionsAreSet_setPlainOptions_shouldCloneSourceArray', () => {
    // Arrange
    const filter = new NoopMinMaxFilter() as unknown as {
      setPlainOptions(options: string[]): void;
      plainOptions: string[];
    };
    const plain = ['A', 'B'];
    filter.setPlainOptions(plain);
    plain.push('C');
    // Assert
    expect(filter.plainOptions).toEqual(['A', 'B']);
  });

  it('whenSelectedMinAndMaxAreUpdated_getters_shouldReturnAssignedValues', () => {
    // Arrange
    const filter = new NoopMinMaxFilter();
    // Action
    filter.setSelectedMin('100');
    filter.setSelectedMax('900');
    // Assert
    expect(filter.getSelectedMin()).toBe('100');
    expect(filter.getSelectedMax()).toBe('900');
  });

  it.each([
    { factory: () => new Price(), min: ['100000'], max: ['500000'] },
    { factory: () => new Size(), min: ['40'], max: ['120'] }
  ])('whenMinMaxOptionsAreSet_setMinOptionsAndSetMaxOptions_shouldCloneSourceArrays', ({ factory, min, max }) => {
    // Arrange
    const filter = factory() as unknown as { setMinOptions(options: string[]): void; setMaxOptions(options: string[]): void; minOptions: string[]; maxOptions: string[] };
    filter.setMinOptions(min);
    filter.setMaxOptions(max);
    min.push('900000');
    max.push('900');
    // Action
    const values = { min: filter.minOptions, max: filter.maxOptions };
    // Assert
    expect(values).toEqual({ min: [min[0]], max: [max[0]] });
  });

  it.each([
    {
      operation: (filter: NoopMinMaxFilter): void => {
        filter.setMinOptions(['1', '2']);
      }
    },
    {
      operation: (filter: NoopMinMaxFilter): void => {
        filter.setMaxOptions(['10', '20']);
      }
    }
  ])('whenFilterDoesNotOverrideMinMaxSetters_applyNoopSetters_shouldNotThrow', ({ operation }) => {
    // Arrange
    const filter = new NoopMinMaxFilter();
    // Action
    const action = (): void => operation(filter);
    // Assert
    expect(action).not.toThrow();
  });

  it('whenSupportedFiltersAreRequested_getSupportedFilters_shouldExposeConfiguredList', () => {
    // Arrange
    const supportedFilters = new SupportedFilters();
    // Action
    const filters = supportedFilters.getSupportedFilters();
    // Assert
    expect(filters.length).toBe(16);
    expect(filters.some((filter) => filter.getName() === 'Precio')).toBe(true);
    expect(filters.some((filter) => filter.getName() === 'Tipo de inmueble')).toBe(true);
    expect(filters.some((filter) => filter.getId() === FILTER_IDS.PRICE)).toBe(true);
    expect(filters.some((filter) => filter.getId() === FILTER_IDS.PROPERTY_TYPE)).toBe(true);
  });
});
