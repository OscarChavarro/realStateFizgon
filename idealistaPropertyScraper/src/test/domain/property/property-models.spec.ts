import { describe, expect, it } from '@jest/globals';
import { PropertyFeatureGroup } from 'domain/property/property-feature-group';
import { PropertyImage } from 'domain/property/property-image';
import { PropertyMainFeatures } from 'domain/property/property-main-features';
import { Property } from 'domain/property/property';
import { PropertyId } from 'domain/property/property-id';
import { PropertyUrl } from 'domain/property/property-url';
import { Price } from 'domain/property/price';

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
    const property = Property.create({
      propertyId: '123456789',
      url: 'https://www.idealista.com/inmueble/123456789/',
      title: 'Piso en venta',
      location: 'Madrid',
      price: 450000,
      mainFeatures,
      advertiserComment: 'Excelente ubicación',
      featureGroups,
      publicationAge: 'Publicado ayer',
      images
    });
    // Assert
    expect(property.propertyId).toBe('123456789');
    expect(property.url.value).toBe('https://www.idealista.com/inmueble/123456789/');
    expect(property.title).toBe('Piso en venta');
    expect(property.location).toBe('Madrid');
    expect(property.price).toBe(450000);
    expect(property.mainFeatures).toBe(mainFeatures);
    expect(property.advertiserComment).toBe('Excelente ubicación');
    expect(property.featureGroups).toEqual(featureGroups);
    expect(property.publicationAge).toBe('Publicado ayer');
    expect(property.images).toEqual(images);
    expect(property.geoLocationHint).toBeUndefined();
  });

  it('whenPropertyIdIsNotProvided_create_shouldDeriveIdFromUrl', () => {
    // Arrange
    const mainFeatures = new PropertyMainFeatures(null, null, null, []);
    // Action
    const property = Property.create({
      propertyId: null,
      url: 'https://www.idealista.com/inmueble/987654321/?foo=1',
      title: 'Title',
      location: 'Madrid',
      price: 1000,
      mainFeatures,
      advertiserComment: null,
      featureGroups: [],
      publicationAge: null,
      images: []
    });
    // Assert
    expect(property.propertyId).toBe('987654321');
    expect(property.url.value).toBe('https://www.idealista.com/inmueble/987654321/');
  });

  it('whenPropertyIsCreatedWithPropertyUrlValueObject_create_shouldAcceptTypedUrl', () => {
    // Arrange
    const mainFeatures = new PropertyMainFeatures(null, null, null, []);
    const propertyUrl = PropertyUrl.create('https://www.idealista.com/inmueble/555/?foo=bar');
    // Action
    const property = Property.create({
      propertyId: '555',
      url: propertyUrl,
      title: 'Title',
      location: 'Madrid',
      price: 1000,
      mainFeatures,
      advertiserComment: null,
      featureGroups: [],
      publicationAge: null,
      images: []
    });
    // Assert
    expect(property.url).toBe(propertyUrl);
    expect(property.url.value).toBe('https://www.idealista.com/inmueble/555/');
  });

  it('whenPropertyIdConflictsWithUrl_create_shouldThrowInvariantViolation', () => {
    // Arrange
    const mainFeatures = new PropertyMainFeatures(null, null, null, []);
    // Action
    const action = (): Property => Property.create({
      propertyId: '111',
      url: 'https://www.idealista.com/inmueble/222/',
      title: 'Title',
      location: 'Madrid',
      price: 1000,
      mainFeatures,
      advertiserComment: null,
      featureGroups: [],
      publicationAge: null,
      images: []
    });
    // Assert
    expect(action).toThrow('does not match URL');
  });

  it('whenPriceIsNegative_create_shouldThrowInvariantViolation', () => {
    // Arrange
    const mainFeatures = new PropertyMainFeatures(null, null, null, []);
    // Action
    const action = (): Property => Property.create({
      propertyId: '123',
      url: 'https://www.idealista.com/inmueble/123/',
      title: 'Title',
      location: 'Madrid',
      price: -1,
      mainFeatures,
      advertiserComment: null,
      featureGroups: [],
      publicationAge: null,
      images: []
    });
    // Assert
    expect(action).toThrow('greater than or equal to zero');
  });

  it('whenPropertyIsCopiedWithGeoHintAndImages_copyMethods_shouldPreserveInvariants', () => {
    // Arrange
    const property = Property.create({
      propertyId: '123',
      url: 'https://www.idealista.com/inmueble/123/',
      title: 'Title',
      location: 'Madrid',
      price: 1000,
      mainFeatures: new PropertyMainFeatures(null, null, null, []),
      advertiserComment: null,
      featureGroups: [],
      publicationAge: null,
      images: [new PropertyImage('https://img/1.jpg', null)]
    });
    // Action
    const withGeo = property.withGeoLocationHint({ lat: 40.4, lon: -3.7 });
    const withImages = withGeo.withImages([new PropertyImage('https://img/2.jpg', 'dos')]);
    // Assert
    expect(withGeo.geoLocationHint).toEqual({ lat: 40.4, lon: -3.7 });
    expect(withImages.images.map((image) => image.url)).toEqual(['https://img/2.jpg']);
    expect(withImages.propertyId).toBe('123');
    expect(withImages.url.value).toBe('https://www.idealista.com/inmueble/123/');
  });

  it('whenValueObjectsAreCreated_constructors_shouldEnforceExplicitInvariants', () => {
    // Arrange
    const validId = PropertyId.create('123');
    const validPrice = Price.create(1000);
    // Action
    const invalidId = (): PropertyId => PropertyId.create('ABC');
    const invalidPrice = (): Price => Price.create(-10);
    // Assert
    expect(validId.value).toBe('123');
    expect(validPrice.toNumber()).toBe(1000);
    expect(invalidId).toThrow('only digits');
    expect(invalidPrice).toThrow('greater than or equal to zero');
  });

  it('whenPropertyContainsBlankOptionalTexts_create_shouldNormalizeThemToNull', () => {
    // Action
    const property = Property.create({
      propertyId: null,
      url: 'https://www.idealista.com/alquiler-viviendas/madrid/',
      title: '   ',
      location: '\t',
      price: null,
      mainFeatures: new PropertyMainFeatures(null, null, null, []),
      advertiserComment: '  ',
      featureGroups: [],
      publicationAge: ' ',
      images: []
    });
    // Assert
    expect(property.title).toBeNull();
    expect(property.location).toBeNull();
    expect(property.advertiserComment).toBeNull();
    expect(property.publicationAge).toBeNull();
  });

  it('whenPropertyIsCopiedWithPropertyIdAndValueObjectsAreRead_domainAccessors_shouldExposeValueObjects', () => {
    // Arrange
    const property = Property.create({
      propertyId: null,
      url: 'https://www.idealista.com/alquiler-viviendas/madrid/',
      title: 'Title',
      location: 'Madrid',
      price: 1200,
      mainFeatures: new PropertyMainFeatures(null, null, null, []),
      advertiserComment: null,
      featureGroups: [],
      publicationAge: null,
      images: []
    });
    // Action
    const withPropertyId = property.withPropertyId('555');
    // Assert
    expect(withPropertyId.propertyId).toBe('555');
    expect(withPropertyId.propertyIdValueObject?.value).toBe('555');
    expect(withPropertyId.urlValueObject.value).toBe('https://www.idealista.com/alquiler-viviendas/madrid/');
    expect(withPropertyId.priceValueObject?.value).toBe(1200);
  });
});
