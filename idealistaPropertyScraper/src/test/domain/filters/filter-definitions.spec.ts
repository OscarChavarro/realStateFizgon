import { describe, expect, it } from '@jest/globals';
import { Bathrooms } from 'domain/filters/bathrooms.filter';
import { Condition } from 'domain/filters/condition.filter';
import { EnergyEfficiency } from 'domain/filters/energy-efficiency.filter';
import { Equipment } from 'domain/filters/equipment.filter';
import { Features } from 'domain/filters/features.filter';
import { Filter } from 'domain/filters/filter';
import { FilterType } from 'domain/filters/filter-type.enum';
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

class NoopMinMaxFilter extends Filter {
  constructor() {
    super('Noop', '#noop', FilterType.MIN_MAX);
  }
}

describe('Filter definitions', () => {
  it.each([
    { factory: () => new Bathrooms(), name: 'Baños', selector: 'div.item-form:has(input[name="adfilter_baths_1"])', type: FilterType.MULTIPLE_SELECTOR },
    { factory: () => new Condition(), name: 'Estado', selector: 'div.item-form:has(input[name="adfilter_newconstruction"])', type: FilterType.MULTIPLE_SELECTOR },
    { factory: () => new EnergyEfficiency(), name: 'Eficiencia Energética', selector: 'div.item-form:has(input[name="adfilter_energyCertificateHigh"])', type: FilterType.MULTIPLE_SELECTOR },
    { factory: () => new Equipment(), name: 'Equipamiento', selector: 'div.item-form:has(#qa_adfilter_amenity), div.dropdown-list:has(#qa_adfilter_amenity)', type: FilterType.SINGLE_SELECTOR_DROPDOWN },
    { factory: () => new Features(), name: 'Características', selector: 'div.item-form:has(input[name="adfilter_housingpetsallowed"])', type: FilterType.MULTIPLE_SELECTOR },
    { factory: () => new Floor(), name: 'Planta', selector: 'div.item-form:has(input[name="adfilter_top_floor"])', type: FilterType.MULTIPLE_SELECTOR },
    { factory: () => new HousingType(), name: 'Tipo de vivienda', selector: 'div.item-form:has(input[data-qa="adfilter_homes"])', type: FilterType.MULTIPLE_SELECTOR },
    { factory: () => new ListingType(), name: 'Tipo de anuncio', selector: 'div.item-form:has(input[name="adfilter_agencyisabank"])', type: FilterType.MULTIPLE_SELECTOR },
    { factory: () => new Multimedia(), name: 'Multimedia', selector: 'div.item-form:has(input[name="adfilter_hasplan"])', type: FilterType.MULTIPLE_SELECTOR },
    { factory: () => new OtherDenominations(), name: 'Otras denominaciones', selector: 'div.item-form:has(#otherDenominationsGroup)', type: FilterType.MULTIPLE_SELECTOR },
    { factory: () => new Price(), name: 'Precio', selector: '#price-filter-container', type: FilterType.MIN_MAX },
    { factory: () => new PropertyType(), name: 'Tipo de inmueble', selector: '#filter-form > .item-form.typology-filter-container', type: FilterType.SINGLE_SELECTOR_DROPDOWN },
    { factory: () => new PublicationDate(), name: 'Fecha de publicación', selector: 'fieldset.item-form.publication-date', type: FilterType.SINGLE_SELECTOR },
    { factory: () => new RentalType(), name: 'Tipo de alquiler', selector: 'div.item-form:has(input[name="adfilter_longTermRental"])', type: FilterType.MULTIPLE_SELECTOR },
    { factory: () => new Rooms(), name: 'Habitaciones', selector: 'div.item-form:has(input[name="adfilter_rooms_0"])', type: FilterType.MULTIPLE_SELECTOR },
    { factory: () => new Size(), name: 'Tamaño', selector: '#area-filter-container', type: FilterType.MIN_MAX }
  ])('whenFilterIsInstantiated_getters_shouldExposeStaticDefinition', ({ factory, name, selector, type }) => {
    // Arrange
    const filter = factory();
    // Action
    const values = { name: filter.getName(), selector: filter.getCssSelector(), type: filter.getType() };
    // Assert
    expect(values).toEqual({ name, selector, type });
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
});
