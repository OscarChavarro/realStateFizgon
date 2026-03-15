import { TestBed } from '@angular/core/testing';
import { KeyboardFlowUseCaseService } from 'src/app/listing/services/keyboard-flow.use-case.service';
import { WorkspaceInteractionCoordinatorService } from 'src/app/listing/services/workspace-interaction-coordinator.service';

describe('KeyboardFlowUseCaseService', () => {
  let service: KeyboardFlowUseCaseService;
  let workspaceInteractionCoordinatorServiceMock: {
    handleWindowKeyDown: jasmine.Spy;
  };

  beforeEach(() => {
    workspaceInteractionCoordinatorServiceMock = {
      handleWindowKeyDown: jasmine.createSpy('handleWindowKeyDown')
    };

    TestBed.configureTestingModule({
      providers: [
        KeyboardFlowUseCaseService,
        { provide: WorkspaceInteractionCoordinatorService, useValue: workspaceInteractionCoordinatorServiceMock }
      ]
    });

    service = TestBed.inject(KeyboardFlowUseCaseService);
  });

  it('handleWindowKeyDown should delegate to workspace interaction coordinator', () => {
    // Arrange
    const params = {
      event: new KeyboardEvent('keydown'),
      activeTab: 'DASHBOARD' as const,
      isAuthenticated: true,
      properties: [],
      selectedProperty: null,
      onTogglePropertyReview: jasmine.createSpy('onTogglePropertyReview'),
      onTogglePropertyLocationDialog: jasmine.createSpy('onTogglePropertyLocationDialog'),
      scroller: undefined
    };

    // Action
    service.handleWindowKeyDown(params);

    // Assert
    expect(workspaceInteractionCoordinatorServiceMock.handleWindowKeyDown).toHaveBeenCalledOnceWith(params);
  });
});
