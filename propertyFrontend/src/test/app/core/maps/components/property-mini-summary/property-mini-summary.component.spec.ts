import { TestBed } from '@angular/core/testing';
import { PropertyMiniSummaryComponent } from 'src/app/core/maps/components/property-mini-summary/property-mini-summary.component';
import { GoogleMapPropertyReview } from 'src/app/core/maps/model/google-map-property.model';
import { I18nService } from 'src/app/core/i18n/services/i18n.service';

class PropertyMiniSummaryComponentMockFactory {
  static createI18nMock() {
    return {
      get: jasmine
        .createSpy('get')
        .and.callFake((id: string, language: string) => `${id}:${language}`)
    };
  }

  static createComponent(i18nMock: { get: jasmine.Spy }): PropertyMiniSummaryComponent {
    TestBed.configureTestingModule({
      providers: [{ provide: I18nService, useValue: i18nMock }]
    });
    const component = TestBed.runInInjectionContext(() => new PropertyMiniSummaryComponent());
    component.property = {
      id: 'map-1',
      propertyId: 'p-1',
      title: 'Title',
      price: '1400',
      latitude: 40.4,
      longitude: -3.7,
      review: 'NEW',
      imageUrls: []
    };
    return component;
  }
}

describe('PropertyMiniSummaryComponent', () => {
  it('onCloseClick should emit closeRequested', () => {
    // Arrange
    const i18nMock = PropertyMiniSummaryComponentMockFactory.createI18nMock();
    const component = PropertyMiniSummaryComponentMockFactory.createComponent(i18nMock);
    const emitSpy = spyOn(component.closeRequested, 'emit');

    // Action
    component.onCloseClick();

    // Assert
    expect(emitSpy).toHaveBeenCalledTimes(1);
  });

  it('t should delegate translation lookup', () => {
    // Arrange
    const i18nMock = PropertyMiniSummaryComponentMockFactory.createI18nMock();
    const component = PropertyMiniSummaryComponentMockFactory.createComponent(i18nMock);
    component.selectedLanguage = 'sp';

    // Action
    const result = component.t('REVIEW_NEW');

    // Assert
    expect(i18nMock.get).toHaveBeenCalledOnceWith('REVIEW_NEW', 'sp');
    expect(result).toBe('REVIEW_NEW:sp');
  });

  [
    {
      review: 'FAVOURITE',
      expectedClass: 'favourite',
      expectedIcon: 'check',
      expectedText: 'REVIEW_FAVOURITE:en'
    },
    {
      review: 'DISCHARGED',
      expectedClass: 'discharged',
      expectedIcon: 'close',
      expectedText: 'REVIEW_DISCHARGED:en'
    },
    { review: 'NEW', expectedClass: 'new', expectedIcon: 'flare', expectedText: 'REVIEW_NEW:en' }
  ].forEach(({ review, expectedClass, expectedIcon, expectedText }) => {
    it(`review helpers should map ${review}`, () => {
      // Arrange
      const i18nMock = PropertyMiniSummaryComponentMockFactory.createI18nMock();
      const component = PropertyMiniSummaryComponentMockFactory.createComponent(i18nMock);
      component.property.review = review as GoogleMapPropertyReview;

      // Action
      const reviewClass = component.getReviewClass();
      const reviewIcon = component.getReviewIcon();
      const reviewText = component.getReviewText();

      // Assert
      expect(reviewClass).toBe(expectedClass);
      expect(reviewIcon).toBe(expectedIcon);
      expect(reviewText).toBe(expectedText);
    });
  });
});
