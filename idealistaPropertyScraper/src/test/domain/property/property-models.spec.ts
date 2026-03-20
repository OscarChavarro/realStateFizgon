import { describe, expect, it } from '@jest/globals';
import { PropertyFeatureGroup } from 'domain/property/property-feature-group.model';
import { PropertyImage } from 'domain/property/property-image.model';
import { PropertyMainFeatures } from 'domain/property/property-main-features.model';
import { Property } from 'domain/property/property.model';

describe('Property domain models', () => {
  it('whenFeatureGroupIsCreated_constructor_shouldExposeNameAndItems', () => {
    // Arrange
    const items = ['Terraza', 'Ascensor'];
    // Action
    const featureGroup = new PropertyFeatureGroup('Características', items);
    // Assert
    expect(featureGroup).toEqual({
      name: 'Características',
      items
    });
  });

  it('whenImageIsCreated_constructor_shouldExposeUrlAndTitle', () => {
    // Arrange
    const url = 'https://img.idealista.com/image.jpg';
    // Action
    const image = new PropertyImage(url, 'Salón');
    // Assert
    expect(image).toEqual({
      url,
      title: 'Salón'
    });
  });

  it('whenMainFeaturesAreCreated_constructor_shouldExposeAllFields', () => {
    // Arrange
    const notes = ['Reformado', 'Exterior'];
    // Action
    const mainFeatures = new PropertyMainFeatures('95 m2', '3 hab.', 'Planta 2ª exterior', notes);
    // Assert
    expect(mainFeatures).toEqual({
      area: '95 m2',
      bedrooms: '3 hab.',
      buildingLocation: 'Planta 2ª exterior',
      additionalNotes: notes
    });
  });

  it('whenPropertyIsCreated_constructor_shouldExposeCompleteAggregate', () => {
    // Arrange
    const mainFeatures = new PropertyMainFeatures('95 m2', '3 hab.', 'Planta 2ª exterior', ['Reformado']);
    const featureGroups = [new PropertyFeatureGroup('Equipamiento', ['Aire acondicionado'])];
    const images = [new PropertyImage('https://img.idealista.com/image.jpg', 'Salón')];
    // Action
    const property = new Property(
      '123456789',
      'https://www.idealista.com/inmueble/123456789/',
      'Piso en venta',
      'Madrid',
      450000,
      mainFeatures,
      'Excelente ubicación',
      featureGroups,
      'Publicado ayer',
      images
    );
    // Assert
    expect(property).toEqual({
      propertyId: '123456789',
      url: 'https://www.idealista.com/inmueble/123456789/',
      title: 'Piso en venta',
      location: 'Madrid',
      price: 450000,
      mainFeatures,
      advertiserComment: 'Excelente ubicación',
      featureGroups,
      publicationAge: 'Publicado ayer',
      images,
      geoLocationHint: undefined
    });
  });
});
