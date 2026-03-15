import { ListingMapTabComponent } from 'src/app/listing/components/listing-map-tab/listing-map-tab.component';
import {
  GeoLocationHint,
  ListingPropertyRow,
  PropertyLabelEntry,
  PropertyReviewLabel
} from 'src/app/listing/model/listing.types';

class ListingMapTabMockFactory {
  static createPropertyRow(overrides: Partial<ListingPropertyRow> = {}): ListingPropertyRow {
    const defaultGeo: GeoLocationHint = { lat: 40.4168, lon: -3.7038 };

    return {
      propertyId: 'property-1',
      publicationDate: '2026-03-15T09:00:00.000Z',
      publicationDateShort: '2026-03-15',
      title: 'Sample title',
      url: 'https://example.com/property-1',
      price: '1400',
      location: 'Madrid',
      advertiserComment: 'Sample comment',
      localImageUrls: ['a.jpg'],
      unavailable: false,
      geoLocationHint: defaultGeo,
      ...overrides
    };
  }

  static createLabel(propertyId: string, review: PropertyReviewLabel): PropertyLabelEntry {
    return {
      propertyId,
      labels: { review }
    };
  }

  static createLabelWithRawReview(propertyId: string, review: unknown): PropertyLabelEntry {
    return {
      propertyId,
      labels: { review: review as never }
    };
  }
}

describe('ListingMapTabComponent', () => {
  let component: ListingMapTabComponent;

  beforeEach(() => {
    component = new ListingMapTabComponent();
  });

  it('whenPropertiesSetterReceivesNonArray_shouldResetPropertiesAndMapProperties', () => {
    // Arrange
    component.properties = [ListingMapTabMockFactory.createPropertyRow()];

    // Action
    component.properties = null as unknown as ListingPropertyRow[];

    // Assert
    expect(component.properties).toEqual([]);
    expect(component.mapProperties).toEqual([]);
  });

  it('whenPropertyLabelsSetterReceivesNonArray_shouldResetLabelsAndKeepDefaultReview', () => {
    // Arrange
    component.properties = [ListingMapTabMockFactory.createPropertyRow({ propertyId: 'p-default-review' })];

    // Action
    component.propertyLabels = null as unknown as [];

    // Assert
    expect(component.propertyLabels).toEqual([]);
    expect(component.mapProperties.length).toBe(1);
    expect(component.mapProperties[0].review).toBe('NEW');
  });

  it('whenCoordinatesUseDifferentInputFormats_shouldIncludeOnlyValidRows', () => {
    // Arrange
    const rows: ListingPropertyRow[] = [
      ListingMapTabMockFactory.createPropertyRow({
        propertyId: 'number',
        geoLocationHint: { lat: 40.1, lon: -3.1 }
      }),
      ListingMapTabMockFactory.createPropertyRow({
        propertyId: 'string',
        geoLocationHint: { lat: '40.2' as unknown as number, lon: '-3.2' as unknown as number }
      }),
      ListingMapTabMockFactory.createPropertyRow({
        propertyId: 'decimal',
        geoLocationHint: {
          lat: { $numberDecimal: '40.3' } as unknown as number,
          lon: { $numberDecimal: ' -3.3 ' } as unknown as number
        }
      }),
      ListingMapTabMockFactory.createPropertyRow({
        propertyId: 'infinite',
        geoLocationHint: { lat: Number.POSITIVE_INFINITY, lon: -3.4 }
      }),
      ListingMapTabMockFactory.createPropertyRow({
        propertyId: 'empty-string',
        geoLocationHint: { lat: '   ' as unknown as number, lon: '-3.5' as unknown as number }
      }),
      ListingMapTabMockFactory.createPropertyRow({
        propertyId: 'invalid-string-number',
        geoLocationHint: { lat: 'not-a-number' as unknown as number, lon: '-3.51' as unknown as number }
      }),
      ListingMapTabMockFactory.createPropertyRow({
        propertyId: 'invalid-decimal',
        geoLocationHint: {
          lat: { $numberDecimal: 'abc' } as unknown as number,
          lon: { $numberDecimal: '-3.6' } as unknown as number
        }
      }),
      ListingMapTabMockFactory.createPropertyRow({
        propertyId: 'object-without-decimal',
        geoLocationHint: {
          lat: {} as unknown as number,
          lon: '-3.7' as unknown as number
        }
      }),
      ListingMapTabMockFactory.createPropertyRow({
        propertyId: 'null-geo',
        geoLocationHint: null
      })
    ];

    // Action
    component.properties = rows;

    // Assert
    expect(component.mapProperties.map((item) => item.propertyId)).toEqual(['number', 'string', 'decimal']);
    expect(component.mapProperties[0].latitude).toBe(40.1);
    expect(component.mapProperties[1].latitude).toBe(40.2);
    expect(component.mapProperties[2].latitude).toBe(40.3);
  });

  (['NEW', 'FAVOURITE', 'DISCHARGED'] as PropertyReviewLabel[]).forEach((review) => {
    it(`whenLabelReviewIs${review}_shouldMapSameReview`, () => {
      // Arrange
      const row = ListingMapTabMockFactory.createPropertyRow({ propertyId: `property-${review}` });
      component.propertyLabels = [ListingMapTabMockFactory.createLabel(`property-${review}`, review)];

      // Action
      component.properties = [row];

      // Assert
      expect(component.mapProperties.length).toBe(1);
      expect(component.mapProperties[0].review).toBe(review);
    });
  });

  it('whenLabelReviewIsUnknown_shouldFallbackToNew', () => {
    // Arrange
    const row = ListingMapTabMockFactory.createPropertyRow({ propertyId: 'property-unknown-review' });
    component.propertyLabels = [
      ListingMapTabMockFactory.createLabelWithRawReview('property-unknown-review', 'NOT_SUPPORTED_REVIEW')
    ];

    // Action
    component.properties = [row];

    // Assert
    expect(component.mapProperties[0].review).toBe('NEW');
  });

  it('whenBuildingMapProperties_shouldApplyFallbacksAndNormalizeFields', () => {
    // Arrange
    component.staticMediaBaseUrl = 'http://static.example.com';
    component.propertyLabels = [
      ListingMapTabMockFactory.createLabel('p1', 'FAVOURITE'),
      ListingMapTabMockFactory.createLabel('', 'DISCHARGED')
    ];
    component.properties = [
      ListingMapTabMockFactory.createPropertyRow({
        propertyId: 'p1',
        title: 'Property One',
        price: '1550',
        unavailable: true,
        localImageUrls: ['a.jpg', ' ', 'b.jpg', 2 as unknown as string],
        geoLocationHint: { lat: 40.41, lon: -3.70 }
      }),
      ListingMapTabMockFactory.createPropertyRow({
        propertyId: '',
        url: 'https://example.com/property-two',
        title: 'Property Two',
        price: '',
        unavailable: false,
        localImageUrls: ['c.jpg'],
        geoLocationHint: { lat: 40.42, lon: -3.71 }
      }),
      ListingMapTabMockFactory.createPropertyRow({
        propertyId: '',
        url: '',
        title: 'Fallback Title Id',
        localImageUrls: ['d.jpg'],
        geoLocationHint: { lat: 40.425, lon: -3.715 }
      }),
      ListingMapTabMockFactory.createPropertyRow({
        propertyId: '   ',
        url: '',
        title: '',
        price: '',
        localImageUrls: ['z.jpg'],
        geoLocationHint: { lat: 40.43, lon: -3.72 }
      }),
      ListingMapTabMockFactory.createPropertyRow({
        propertyId: 'non-array-images',
        localImageUrls: 'not-an-array' as unknown as string[],
        geoLocationHint: { lat: 40.44, lon: -3.73 }
      }),
      ListingMapTabMockFactory.createPropertyRow({
        propertyId: undefined as unknown as string,
        url: 'https://example.com/property-undefined-id',
        localImageUrls: ['e.jpg'],
        geoLocationHint: { lat: 40.45, lon: -3.74 }
      })
    ];

    // Action
    const [first, second, third, fourth, fifth, sixth] = component.mapProperties;

    // Assert
    expect(first.id).toBe('p1');
    expect(first.closed).toBeTrue();
    expect(first.review).toBe('FAVOURITE');
    expect(first.imageUrls).toEqual([
      'http://static.example.com/p1/a.jpg',
      'http://static.example.com/p1/b.jpg'
    ]);

    expect(second.id).toBe('https://example.com/property-two');
    expect(second.propertyId).toBe('');
    expect(second.price).toBe('-');
    expect(second.review).toBe('DISCHARGED');
    expect(second.imageUrls).toEqual([]);

    expect(third.id).toBe('Fallback Title Id');
    expect(third.title).toBe('Fallback Title Id');
    expect(third.imageUrls).toEqual([]);

    expect(fourth.title).toBe('-');
    expect(fourth.price).toBe('-');
    expect(fourth.imageUrls).toEqual([]);

    expect(fifth.imageUrls).toEqual([]);

    expect(sixth.propertyId).toBe('');
    expect(sixth.imageUrls).toEqual([]);
  });

  it('whenStaticMediaBaseUrlAlreadyEndsWithSlash_shouldNotDuplicateSlashInImageUrl', () => {
    // Arrange
    component.staticMediaBaseUrl = 'http://static.example.com/';
    component.properties = [
      ListingMapTabMockFactory.createPropertyRow({
        propertyId: 'property-slash',
        localImageUrls: ['image.jpg'],
        geoLocationHint: { lat: 40.45, lon: -3.74 }
      })
    ];

    // Action
    const [mapped] = component.mapProperties;

    // Assert
    expect(mapped.imageUrls).toEqual(['http://static.example.com/property-slash/image.jpg']);
  });
});
