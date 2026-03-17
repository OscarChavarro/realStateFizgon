import { HttpClient } from '@angular/common/http';
import { PropertyLabelEntry, PropertyReviewLabel } from 'src/app/listing/model/listing.types';
import { PropertyLabelsFacadeService } from 'src/app/prefs/services/property-labels-facade.service';
import { UserPreferencesService } from 'src/app/prefs/services/user-preferences.service';

class PropertyLabelsFacadeServiceMockFactory {
  static createHttpClientMock(): HttpClient {
    return {} as HttpClient;
  }

  static createUserPreferencesMock() {
    return {
      setPropertyReview: jasmine.createSpy('setPropertyReview').and.resolveTo([]),
      setPropertyComment: jasmine.createSpy('setPropertyComment').and.resolveTo([])
    };
  }

  static createLabels(entries: PropertyLabelEntry[] = []): PropertyLabelEntry[] {
    return entries;
  }
}

describe('PropertyLabelsFacadeService', () => {
  [
    { labels: [{ propertyId: 'p-1', labels: { review: 'NEW' } }], expected: 'NEW' },
    { labels: [{ propertyId: 'p-1', labels: { review: 'FAVOURITE' } }], expected: 'FAVOURITE' },
    { labels: [{ propertyId: 'p-1', labels: { review: 'DISCHARGED' } }], expected: 'DISCHARGED' },
    { labels: [{ propertyId: 'p-1', labels: { review: 'INVALID' as any } }], expected: 'NEW' },
    { labels: [], expected: 'NEW' }
  ].forEach(({ labels, expected }) => {
    it(`getPropertyReviewLabel should return ${expected}`, () => {
      // Arrange
      const userPreferences = PropertyLabelsFacadeServiceMockFactory.createUserPreferencesMock();
      const service = new PropertyLabelsFacadeService(
        userPreferences as unknown as UserPreferencesService
      );

      // Action
      const result = service.getPropertyReviewLabel(
        PropertyLabelsFacadeServiceMockFactory.createLabels(labels),
        'p-1'
      );

      // Assert
      expect(result).toBe(expected as any);
    });
  });

  [
    { labels: [{ propertyId: 'p-1', labels: { comment: 'saved' } }], expected: 'saved' },
    { labels: [{ propertyId: 'p-1', labels: { comment: 1 as any } }], expected: '' },
    { labels: [], expected: '' }
  ].forEach(({ labels, expected }) => {
    it(`getPropertyComment should return "${expected}"`, () => {
      // Arrange
      const userPreferences = PropertyLabelsFacadeServiceMockFactory.createUserPreferencesMock();
      const service = new PropertyLabelsFacadeService(
        userPreferences as unknown as UserPreferencesService
      );

      // Action
      const result = service.getPropertyComment(
        PropertyLabelsFacadeServiceMockFactory.createLabels(labels),
        'p-1'
      );

      // Assert
      expect(result).toBe(expected);
    });
  });

  const toggleReviewCases: ReadonlyArray<{
    current: PropertyReviewLabel;
    expected: PropertyReviewLabel;
  }> = [
    { current: 'NEW', expected: 'FAVOURITE' },
    { current: 'FAVOURITE', expected: 'DISCHARGED' },
    { current: 'DISCHARGED', expected: 'NEW' }
  ];

  toggleReviewCases.forEach(({ current, expected }) => {
    it(`togglePropertyReview should move ${current} to ${expected}`, async () => {
      // Arrange
      const userPreferences = PropertyLabelsFacadeServiceMockFactory.createUserPreferencesMock();
      const service = new PropertyLabelsFacadeService(
        userPreferences as unknown as UserPreferencesService
      );
      const http = PropertyLabelsFacadeServiceMockFactory.createHttpClientMock();
      userPreferences.setPropertyReview.and.resolveTo([
        { propertyId: 'p-1', labels: { review: expected } }
      ]);

      // Action
      const result = await service.togglePropertyReview(http, 'p-1', [
        { propertyId: 'p-1', labels: { review: current } }
      ]);

      // Assert
      expect(userPreferences.setPropertyReview).toHaveBeenCalledOnceWith(http, 'p-1', expected);
      expect(result).toEqual([{ propertyId: 'p-1', labels: { review: expected } }]);
    });
  });

  it('savePropertyComment should return null when trimmed comment does not change', async () => {
    // Arrange
    const userPreferences = PropertyLabelsFacadeServiceMockFactory.createUserPreferencesMock();
    const service = new PropertyLabelsFacadeService(
      userPreferences as unknown as UserPreferencesService
    );
    const http = PropertyLabelsFacadeServiceMockFactory.createHttpClientMock();

    // Action
    const result = await service.savePropertyComment(http, 'p-1', '  note  ', [
      { propertyId: 'p-1', labels: { comment: 'note' } }
    ]);

    // Assert
    expect(result).toBeNull();
    expect(userPreferences.setPropertyComment).not.toHaveBeenCalled();
  });

  it('savePropertyComment should persist trimmed comment when it changes', async () => {
    // Arrange
    const userPreferences = PropertyLabelsFacadeServiceMockFactory.createUserPreferencesMock();
    const service = new PropertyLabelsFacadeService(
      userPreferences as unknown as UserPreferencesService
    );
    const http = PropertyLabelsFacadeServiceMockFactory.createHttpClientMock();
    userPreferences.setPropertyComment.and.resolveTo([
      { propertyId: 'p-1', labels: { comment: 'note-2' } }
    ]);

    // Action
    const result = await service.savePropertyComment(http, 'p-1', '  note-2  ', [
      { propertyId: 'p-1', labels: { comment: 'note-1' } }
    ]);

    // Assert
    expect(userPreferences.setPropertyComment).toHaveBeenCalledOnceWith(http, 'p-1', 'note-2');
    expect(result).toEqual([{ propertyId: 'p-1', labels: { comment: 'note-2' } }]);
  });

  it('mergeLabelEntries should append a new entry when property is missing', () => {
    // Arrange
    const userPreferences = PropertyLabelsFacadeServiceMockFactory.createUserPreferencesMock();
    const service = new PropertyLabelsFacadeService(
      userPreferences as unknown as UserPreferencesService
    );
    const current = [{ propertyId: 'p-1', labels: { review: 'NEW' as const } }];

    // Action
    const result = service.mergeLabelEntries(current, 'p-2', { comment: 'note' });

    // Assert
    expect(result).toEqual([
      { propertyId: 'p-1', labels: { review: 'NEW' } },
      { propertyId: 'p-2', labels: { comment: 'note' } }
    ]);
    expect(result).not.toBe(current);
  });

  it('mergeLabelEntries should merge labels in existing entry', () => {
    // Arrange
    const userPreferences = PropertyLabelsFacadeServiceMockFactory.createUserPreferencesMock();
    const service = new PropertyLabelsFacadeService(
      userPreferences as unknown as UserPreferencesService
    );
    const current = [
      { propertyId: 'p-1', labels: { review: 'NEW' as const, comment: 'old' } },
      { propertyId: 'p-2', labels: { review: 'FAVOURITE' as const } }
    ];

    // Action
    const result = service.mergeLabelEntries(current, 'p-1', { comment: 'new', score: 10 });

    // Assert
    expect(result).toEqual([
      { propertyId: 'p-1', labels: { review: 'NEW', comment: 'new', score: 10 } },
      { propertyId: 'p-2', labels: { review: 'FAVOURITE' } }
    ]);
    expect(result[1]).toEqual(current[1]);
  });
});
