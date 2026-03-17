import { TestBed } from '@angular/core/testing';
import { ListingBootstrapUseCaseService } from 'src/app/listing/services/listing-bootstrap.use-case.service';
import { WorkspaceInteractionCoordinatorService } from 'src/app/listing/services/workspace-interaction-coordinator.service';

describe('ListingBootstrapUseCaseService', () => {
  let service: ListingBootstrapUseCaseService;
  let workspaceInteractionCoordinatorServiceMock: {
    connectUpdatesSocket: jasmine.Spy;
    disconnectUpdatesSocket: jasmine.Spy;
  };

  beforeEach(() => {
    workspaceInteractionCoordinatorServiceMock = {
      connectUpdatesSocket: jasmine.createSpy('connectUpdatesSocket'),
      disconnectUpdatesSocket: jasmine.createSpy('disconnectUpdatesSocket')
    };

    TestBed.configureTestingModule({
      providers: [
        ListingBootstrapUseCaseService,
        {
          provide: WorkspaceInteractionCoordinatorService,
          useValue: workspaceInteractionCoordinatorServiceMock
        }
      ]
    });

    service = TestBed.inject(ListingBootstrapUseCaseService);
  });

  it('initialize should refresh listing data and connect socket listener', async () => {
    // Arrange
    const refreshSpy = jasmine.createSpy('onRefreshListingData').and.resolveTo(undefined);

    // Action
    await service.initialize({ onRefreshListingData: refreshSpy });
    const callback =
      workspaceInteractionCoordinatorServiceMock.connectUpdatesSocket.calls.mostRecent().args[0];
    await callback();

    // Assert
    expect(refreshSpy).toHaveBeenCalledTimes(2);
    expect(workspaceInteractionCoordinatorServiceMock.connectUpdatesSocket).toHaveBeenCalled();
  });

  it('teardown should disconnect socket', () => {
    // Arrange

    // Action
    service.teardown();

    // Assert
    expect(workspaceInteractionCoordinatorServiceMock.disconnectUpdatesSocket).toHaveBeenCalled();
  });
});
