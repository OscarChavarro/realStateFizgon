import { TestBed } from '@angular/core/testing';
import { PropertyLabelEntry } from 'src/app/listing/model/listing.types';
import { ListingInteractionUseCaseService } from 'src/app/listing/services/listing-interaction.use-case.service';
import { PropertyLabelsFacadeService } from 'src/app/prefs/services/property-labels-facade.service';

describe('ListingInteractionUseCaseService', () => {
  let service: ListingInteractionUseCaseService;
  let propertyLabelsFacadeServiceMock: {
    togglePropertyReview: jasmine.Spy;
    savePropertyComment: jasmine.Spy;
  };

  beforeEach(() => {
    propertyLabelsFacadeServiceMock = {
      togglePropertyReview: jasmine.createSpy('togglePropertyReview'),
      savePropertyComment: jasmine.createSpy('savePropertyComment')
    };

    TestBed.configureTestingModule({
      providers: [
        ListingInteractionUseCaseService,
        { provide: PropertyLabelsFacadeService, useValue: propertyLabelsFacadeServiceMock }
      ]
    });

    service = TestBed.inject(ListingInteractionUseCaseService);
  });

  it('togglePropertyReview should return when user is not authenticated', async () => {
    // Arrange
    const setSpy = jasmine.createSpy('setPropertyLabels');

    // Action
    await service.togglePropertyReview({
      http: {} as any,
      propertyId: 'p-1',
      isAuthenticated: false,
      getPropertyLabels: () => [],
      setPropertyLabels: setSpy
    });

    // Assert
    expect(propertyLabelsFacadeServiceMock.togglePropertyReview).not.toHaveBeenCalled();
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('togglePropertyReview should set labels when facade call succeeds', async () => {
    // Arrange
    const updated: PropertyLabelEntry[] = [{ propertyId: 'p-1', labels: { review: 'FAVOURITE' } }];
    propertyLabelsFacadeServiceMock.togglePropertyReview.and.resolveTo(updated);
    const setSpy = jasmine.createSpy('setPropertyLabels');

    // Action
    await service.togglePropertyReview({
      http: {} as any,
      propertyId: 'p-1',
      isAuthenticated: true,
      getPropertyLabels: () => [],
      setPropertyLabels: setSpy
    });

    // Assert
    expect(setSpy).toHaveBeenCalledOnceWith(updated);
  });

  it('togglePropertyReview should swallow errors from facade', async () => {
    // Arrange
    propertyLabelsFacadeServiceMock.togglePropertyReview.and.rejectWith(new Error('failure'));
    const setSpy = jasmine.createSpy('setPropertyLabels');

    // Action
    await service.togglePropertyReview({
      http: {} as any,
      propertyId: 'p-1',
      isAuthenticated: true,
      getPropertyLabels: () => [],
      setPropertyLabels: setSpy
    });

    // Assert
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('savePropertyComment should return when user is not authenticated', async () => {
    // Arrange
    const setSpy = jasmine.createSpy('setPropertyLabels');

    // Action
    await service.savePropertyComment({
      http: {} as any,
      propertyId: 'p-1',
      commentRaw: 'test',
      isAuthenticated: false,
      getPropertyLabels: () => [],
      setPropertyLabels: setSpy
    });

    // Assert
    expect(propertyLabelsFacadeServiceMock.savePropertyComment).not.toHaveBeenCalled();
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('savePropertyComment should set labels when facade returns entries', async () => {
    // Arrange
    const updated: PropertyLabelEntry[] = [{ propertyId: 'p-1', labels: { comment: 'note' } }];
    propertyLabelsFacadeServiceMock.savePropertyComment.and.resolveTo(updated);
    const setSpy = jasmine.createSpy('setPropertyLabels');

    // Action
    await service.savePropertyComment({
      http: {} as any,
      propertyId: 'p-1',
      commentRaw: 'note',
      isAuthenticated: true,
      getPropertyLabels: () => [],
      setPropertyLabels: setSpy
    });

    // Assert
    expect(setSpy).toHaveBeenCalledOnceWith(updated);
  });

  it('savePropertyComment should not set labels when facade returns null', async () => {
    // Arrange
    propertyLabelsFacadeServiceMock.savePropertyComment.and.resolveTo(null);
    const setSpy = jasmine.createSpy('setPropertyLabels');

    // Action
    await service.savePropertyComment({
      http: {} as any,
      propertyId: 'p-1',
      commentRaw: 'same',
      isAuthenticated: true,
      getPropertyLabels: () => [],
      setPropertyLabels: setSpy
    });

    // Assert
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('savePropertyComment should swallow errors from facade', async () => {
    // Arrange
    propertyLabelsFacadeServiceMock.savePropertyComment.and.rejectWith(new Error('failure'));
    const setSpy = jasmine.createSpy('setPropertyLabels');

    // Action
    await service.savePropertyComment({
      http: {} as any,
      propertyId: 'p-1',
      commentRaw: 'note',
      isAuthenticated: true,
      getPropertyLabels: () => [],
      setPropertyLabels: setSpy
    });

    // Assert
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('togglePropertyReview should use default error policy when request policy is not injected', async () => {
    // Arrange
    const isolatedFacadeMock = {
      togglePropertyReview: jasmine.createSpy('togglePropertyReview').and.rejectWith(new Error('failure')),
      savePropertyComment: jasmine.createSpy('savePropertyComment')
    };
    const serviceWithDefaultPolicy = new ListingInteractionUseCaseService(
      isolatedFacadeMock as any
    );
    const setSpy = jasmine.createSpy('setPropertyLabels');
    const warnSpy = spyOn(console, 'warn');

    // Action
    await serviceWithDefaultPolicy.togglePropertyReview({
      http: {} as any,
      propertyId: 'p-1',
      isAuthenticated: true,
      getPropertyLabels: () => [],
      setPropertyLabels: setSpy
    });

    // Assert
    expect(setSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.calls.mostRecent().args[0]).toContain('listing.togglePropertyReview');
  });
});
