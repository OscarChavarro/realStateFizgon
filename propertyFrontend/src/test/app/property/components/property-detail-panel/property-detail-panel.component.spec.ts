import { TestBed } from '@angular/core/testing';
import { PropertyDetailPanelComponent } from 'src/app/property/components/property-detail-panel/property-detail-panel.component';
import { I18nService } from 'src/app/core/i18n/services/i18n.service';
import { ListingPropertyRow, PropertyLabelEntry } from 'src/app/listing/model/listing.types';

class PropertyDetailPanelMockFactory {
  static createI18nMock() {
    return {
      get: jasmine.createSpy('get').and.callFake((id: string, language: string) => `${id}:${language}`)
    };
  }

  static createComponent(i18nMock: { get: jasmine.Spy }): PropertyDetailPanelComponent {
    TestBed.configureTestingModule({
      providers: [{ provide: I18nService, useValue: i18nMock }]
    });
    return TestBed.runInInjectionContext(() => new PropertyDetailPanelComponent());
  }

  static createProperty(overrides: Partial<ListingPropertyRow> = {}): ListingPropertyRow {
    return {
      propertyId: 'p-1',
      publicationDate: '2026-03-12T10:09:00.000Z',
      publicationDateShort: '2026-03-12',
      title: 'Main title',
      url: 'https://example.com/p-1',
      price: '1400',
      location: 'Madrid',
      advertiserComment: 'Comment',
      localImageUrls: ['a.jpg'],
      unavailable: false,
      geoLocationHint: { lat: 40.4, lon: -3.7 },
      ...overrides
    };
  }

  static createLabels(review?: string, comment?: string): PropertyLabelEntry[] {
    const labels: Record<string, unknown> = {};
    if (review !== undefined) {
      labels['review'] = review;
    }
    if (comment !== undefined) {
      labels['comment'] = comment;
    }
    return [{ propertyId: 'p-1', labels }];
  }
}

describe('PropertyDetailPanelComponent', () => {
  it('t should resolve translation through i18n service', () => {
    // Arrange
    const i18nMock = PropertyDetailPanelMockFactory.createI18nMock();
    const component = PropertyDetailPanelMockFactory.createComponent(i18nMock);
    component.selectedLanguage = 'sp';

    // Action
    const result = component.t('PRICE');

    // Assert
    expect(i18nMock.get).toHaveBeenCalledOnceWith('PRICE', 'sp');
    expect(result).toBe('PRICE:sp');
  });

  [
    { review: 'FAVOURITE', className: 'favourite', icon: 'check', textKey: 'REVIEW_FAVOURITE:en' },
    { review: 'DISCHARGED', className: 'discharged', icon: 'close', textKey: 'REVIEW_DISCHARGED:en' },
    { review: 'NEW', className: 'new', icon: 'flare', textKey: 'REVIEW_NEW:en' },
    { review: 'INVALID', className: 'new', icon: 'flare', textKey: 'REVIEW_NEW:en' }
  ].forEach(({ review, className, icon, textKey }) => {
    it(`review helpers should map "${review}" correctly`, () => {
      // Arrange
      const i18nMock = PropertyDetailPanelMockFactory.createI18nMock();
      const component = PropertyDetailPanelMockFactory.createComponent(i18nMock);
      component.propertyLabels = PropertyDetailPanelMockFactory.createLabels(review);

      // Action
      const resolvedClass = component.getReviewClass('p-1');
      const resolvedIcon = component.getReviewIcon('p-1');
      const resolvedText = component.getReviewText('p-1');

      // Assert
      expect(resolvedClass).toBe(className);
      expect(resolvedIcon).toBe(icon);
      expect(resolvedText).toBe(textKey);
    });
  });

  it('getDraftComment should prioritize draft map over persisted labels', () => {
    // Arrange
    const i18nMock = PropertyDetailPanelMockFactory.createI18nMock();
    const component = PropertyDetailPanelMockFactory.createComponent(i18nMock);
    component.propertyLabels = PropertyDetailPanelMockFactory.createLabels('NEW', 'persisted-comment');

    // Action
    const persisted = component.getDraftComment('p-1');
    component.onDraftCommentInput('p-1', { target: { value: 'draft-comment' } } as unknown as Event);
    const drafted = component.getDraftComment('p-1');

    // Assert
    expect(persisted).toBe('persisted-comment');
    expect(drafted).toBe('draft-comment');
  });

  it('onDraftCommentInput should default to empty string for missing target value', () => {
    // Arrange
    const i18nMock = PropertyDetailPanelMockFactory.createI18nMock();
    const component = PropertyDetailPanelMockFactory.createComponent(i18nMock);

    // Action
    component.onDraftCommentInput('p-1', { target: null } as Event);

    // Assert
    expect(component.getDraftComment('p-1')).toBe('');
  });

  it('onPropertyReviewToggleClick should emit selected property', () => {
    // Arrange
    const i18nMock = PropertyDetailPanelMockFactory.createI18nMock();
    const component = PropertyDetailPanelMockFactory.createComponent(i18nMock);
    const property = PropertyDetailPanelMockFactory.createProperty();
    const emitSpy = spyOn(component.propertyReviewToggle, 'emit');

    // Action
    component.onPropertyReviewToggleClick(property);

    // Assert
    expect(emitSpy).toHaveBeenCalledOnceWith(property);
  });

  it('onDraftCommentBlur should trim and emit property comment', () => {
    // Arrange
    const i18nMock = PropertyDetailPanelMockFactory.createI18nMock();
    const component = PropertyDetailPanelMockFactory.createComponent(i18nMock);
    const property = PropertyDetailPanelMockFactory.createProperty();
    const emitSpy = spyOn(component.propertyCommentSave, 'emit');
    component.onDraftCommentInput(property.propertyId, { target: { value: '  comment value  ' } } as unknown as Event);

    // Action
    component.onDraftCommentBlur(property);

    // Assert
    expect(component.getDraftComment(property.propertyId)).toBe('comment value');
    expect(emitSpy).toHaveBeenCalledOnceWith({ property, comment: 'comment value' });
  });

  it('geo helpers should validate coordinates and resolve latitude/longitude', () => {
    // Arrange
    const i18nMock = PropertyDetailPanelMockFactory.createI18nMock();
    const component = PropertyDetailPanelMockFactory.createComponent(i18nMock);
    const validProperty = PropertyDetailPanelMockFactory.createProperty();
    const invalidProperty = PropertyDetailPanelMockFactory.createProperty({
      geoLocationHint: { lat: Number.NaN, lon: -3.7 }
    });

    // Action
    const validResult = component.hasGeoLocationHint(validProperty);
    const invalidResult = component.hasGeoLocationHint(invalidProperty);
    const validLat = component.getGeoLatitude(validProperty);
    const validLon = component.getGeoLongitude(validProperty);
    const invalidLat = component.getGeoLatitude(invalidProperty);
    const invalidLon = component.getGeoLongitude(invalidProperty);

    // Assert
    expect(validResult).toBeTrue();
    expect(invalidResult).toBeFalse();
    expect(validLat).toBe(40.4);
    expect(validLon).toBe(-3.7);
    expect(invalidLat).toBeNull();
    expect(invalidLon).toBeNull();
  });

  it('getGeoLatitude and getGeoLongitude should cover nullish coordinate fallback branch', () => {
    // Arrange
    const i18nMock = PropertyDetailPanelMockFactory.createI18nMock();
    const component = PropertyDetailPanelMockFactory.createComponent(i18nMock);
    let latitudeAccess = 0;
    const latitudeProperty = {
      get geoLocationHint() {
        latitudeAccess += 1;
        if (latitudeAccess <= 2) {
          return { lat: 40.4, lon: -3.7 };
        }
        return {};
      }
    } as ListingPropertyRow;
    let longitudeAccess = 0;
    const longitudeProperty = {
      get geoLocationHint() {
        longitudeAccess += 1;
        if (longitudeAccess <= 2) {
          return { lat: 40.4, lon: -3.7 };
        }
        return {};
      }
    } as ListingPropertyRow;

    // Action
    const lat = component.getGeoLatitude(latitudeProperty);
    const lon = component.getGeoLongitude(longitudeProperty);

    // Assert
    expect(lat).toBeNull();
    expect(lon).toBeNull();
  });

  it('location dialog controls should open, toggle and close based on property coordinates', () => {
    // Arrange
    const i18nMock = PropertyDetailPanelMockFactory.createI18nMock();
    const component = PropertyDetailPanelMockFactory.createComponent(i18nMock);
    component.property = null;
    component.isLocationDialogOpen = false;

    // Action
    component.toggleLocationDialog();
    const afterNullPropertyToggle = component.isLocationDialogOpen;
    component.property = PropertyDetailPanelMockFactory.createProperty({
      geoLocationHint: { lat: Number.NaN, lon: 10 }
    });
    component.toggleLocationDialog();
    const afterInvalidGeoToggle = component.isLocationDialogOpen;
    component.property = PropertyDetailPanelMockFactory.createProperty();
    component.openLocationDialog();
    const afterOpen = component.isLocationDialogOpen;
    component.toggleLocationDialog();
    const afterToggle = component.isLocationDialogOpen;
    component.closeLocationDialog();
    const afterClose = component.isLocationDialogOpen;

    // Assert
    expect(afterNullPropertyToggle).toBeFalse();
    expect(afterInvalidGeoToggle).toBeFalse();
    expect(afterOpen).toBeTrue();
    expect(afterToggle).toBeFalse();
    expect(afterClose).toBeFalse();
  });

  it('getPublicationDateExtended should return formatted date for date-only and datetime values', () => {
    // Arrange
    const i18nMock = PropertyDetailPanelMockFactory.createI18nMock();
    const component = PropertyDetailPanelMockFactory.createComponent(i18nMock);
    component.selectedLanguage = 'en';

    // Action
    const fromDateOnly = component.getPublicationDateExtended('2026-03-14');
    const fromDateTime = component.getPublicationDateExtended('2026-03-14T10:09:06.684Z');

    // Assert
    expect(fromDateOnly).toContain('2026');
    expect(fromDateOnly.toLowerCase()).toContain('march');
    expect(fromDateTime).toContain('2026');
    expect(fromDateTime).toMatch(/AM|PM/i);
  });

  it('getPublicationDateExtended should format using spanish locale when selectedLanguage is sp', () => {
    // Arrange
    const i18nMock = PropertyDetailPanelMockFactory.createI18nMock();
    const component = PropertyDetailPanelMockFactory.createComponent(i18nMock);
    component.selectedLanguage = 'sp';

    // Action
    const result = component.getPublicationDateExtended('2026-03-14T10:09:06.684Z');

    // Assert
    expect(result).toContain('2026');
    expect(result.toLowerCase()).toContain('marzo');
  });

  it('getPublicationDateExtended should return original value or dash for invalid/empty input', () => {
    // Arrange
    const i18nMock = PropertyDetailPanelMockFactory.createI18nMock();
    const component = PropertyDetailPanelMockFactory.createComponent(i18nMock);

    // Action
    const invalid = component.getPublicationDateExtended('not-a-date');
    const empty = component.getPublicationDateExtended('');
    const blank = component.getPublicationDateExtended('   ');
    const invalidDateOnly = component.getPublicationDateExtended('2026-00-01');

    // Assert
    expect(invalid).toBe('not-a-date');
    expect(empty).toBe('-');
    expect(blank).toBe('   ');
    expect(invalidDateOnly).toBe('2026-00-01');
  });

  it('getDraftComment should return empty string for non-string persisted comment', () => {
    // Arrange
    const i18nMock = PropertyDetailPanelMockFactory.createI18nMock();
    const component = PropertyDetailPanelMockFactory.createComponent(i18nMock);
    component.propertyLabels = [{ propertyId: 'p-1', labels: { comment: 123 as unknown as string } }];

    // Action
    const result = component.getDraftComment('p-1');

    // Assert
    expect(result).toBe('');
  });
});
