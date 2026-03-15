import { GoogleMapMarkerIconFactory } from 'src/app/core/maps/services/google-map-marker-icon-factory';
import { GoogleMapProperty } from 'src/app/core/maps/model/google-map-property.model';

class GoogleMapMarkerIconFactoryMockFactory {
  static createProperty(overrides: Partial<GoogleMapProperty> = {}): GoogleMapProperty {
    return {
      id: 'property-1',
      propertyId: '1',
      title: 'Property 1',
      price: '1400',
      latitude: 40.4,
      longitude: -3.7,
      review: 'NEW',
      imageUrls: [],
      ...overrides
    };
  }
}

function decodeSvgFromDataUrl(dataUrl: string): string {
  return decodeURIComponent(dataUrl.split(',')[1] ?? '');
}

describe('GoogleMapMarkerIconFactory', () => {
  let factory: GoogleMapMarkerIconFactory;

  beforeEach(() => {
    factory = new GoogleMapMarkerIconFactory();
  });

  [
    { review: 'FAVOURITE' as const, expectedColor: '#20a24a' },
    { review: 'DISCHARGED' as const, expectedColor: '#d44343' },
    { review: 'NEW' as const, expectedColor: '#9ca3af' }
  ].forEach(({ review, expectedColor }) => {
    it(`buildPropertyMarkerIconDataUrl should use ${expectedColor} for ${review}`, () => {
      // Arrange
      const property = GoogleMapMarkerIconFactoryMockFactory.createProperty({
        review,
        closed: false
      });

      // Action
      const dataUrl = factory.buildPropertyMarkerIconDataUrl(property);
      const svg = decodeSvgFromDataUrl(dataUrl);

      // Assert
      expect(dataUrl.startsWith('data:image/svg+xml;charset=UTF-8,')).toBeTrue();
      expect(svg).toContain(`<circle cx="19" cy="19" r="18" fill="${expectedColor}"/>`);
      expect(svg).toContain('<path fill="#ffffff"');
      expect(svg).not.toContain('☠');
    });
  });

  it('buildPropertyMarkerIconDataUrl should render closed marker with skull and closed color', () => {
    // Arrange
    const property = GoogleMapMarkerIconFactoryMockFactory.createProperty({
      closed: true,
      review: 'FAVOURITE'
    });

    // Action
    const dataUrl = factory.buildPropertyMarkerIconDataUrl(property);
    const svg = decodeSvgFromDataUrl(dataUrl);

    // Assert
    expect(svg).toContain('<circle cx="19" cy="19" r="18" fill="#4b5563"/>');
    expect(svg).toContain('☠');
    expect(svg).not.toContain('<path fill="#ffffff"');
  });

  it('buildSelectedTargetMarkerIconDataUrl should return encoded yellow target icon', () => {
    // Arrange

    // Action
    const dataUrl = factory.buildSelectedTargetMarkerIconDataUrl();
    const svg = decodeSvgFromDataUrl(dataUrl);

    // Assert
    expect(dataUrl.startsWith('data:image/svg+xml;charset=UTF-8,')).toBeTrue();
    expect(svg).toContain('<circle cx="28" cy="28" r="24"');
    expect(svg).toContain('stroke="#ffd60a"');
  });
});
