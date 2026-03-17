import { ElementRef } from '@angular/core';
import { ListingPropertyRow } from 'src/app/listing/model/listing.types';
import { KeyboardFlowUseCaseService } from 'src/app/listing/services/keyboard-flow.use-case.service';
import { WorkspaceInteractionCoordinatorService } from 'src/app/listing/services/workspace-interaction-coordinator.service';
import { ShellInputInteractionUseCaseService } from 'src/app/shell/services/shell-input-interaction.use-case.service';

class ShellInputInteractionUseCaseMockFactory {
  static createWorkspaceInteractionCoordinatorMock() {
    return {
      startResize: jasmine.createSpy('startResize'),
      handleWindowMouseMove: jasmine.createSpy('handleWindowMouseMove'),
      handleWindowMouseUp: jasmine.createSpy('handleWindowMouseUp')
    };
  }

  static createKeyboardFlowUseCaseMock() {
    return {
      handleWindowKeyDown: jasmine.createSpy('handleWindowKeyDown')
    };
  }

  static createProperty(overrides: Partial<ListingPropertyRow> = {}): ListingPropertyRow {
    return {
      propertyId: 'p-1',
      publicationDate: '2026-03-12T10:00:00.000Z',
      publicationDateShort: '2026-03-12',
      title: 'Title',
      url: 'https://example.com/p-1',
      price: '1400',
      location: 'Madrid',
      advertiserComment: 'comment',
      localImageUrls: [],
      unavailable: false,
      geoLocationHint: null,
      ...overrides
    };
  }
}

describe('ShellInputInteractionUseCaseService', () => {
  it('onSplitterMouseDown should delegate to workspace coordinator', () => {
    // Arrange
    const workspaceCoordinator =
      ShellInputInteractionUseCaseMockFactory.createWorkspaceInteractionCoordinatorMock();
    const keyboardFlow = ShellInputInteractionUseCaseMockFactory.createKeyboardFlowUseCaseMock();
    const service = new ShellInputInteractionUseCaseService(
      workspaceCoordinator as unknown as WorkspaceInteractionCoordinatorService,
      keyboardFlow as unknown as KeyboardFlowUseCaseService
    );
    const event = { clientX: 10 } as MouseEvent;

    // Action
    service.onSplitterMouseDown(event);

    // Assert
    expect(workspaceCoordinator.startResize).toHaveBeenCalledOnceWith(event);
  });

  it('onWindowMouseMove should delegate with container element or null fallback', () => {
    // Arrange
    const workspaceCoordinator =
      ShellInputInteractionUseCaseMockFactory.createWorkspaceInteractionCoordinatorMock();
    const keyboardFlow = ShellInputInteractionUseCaseMockFactory.createKeyboardFlowUseCaseMock();
    const service = new ShellInputInteractionUseCaseService(
      workspaceCoordinator as unknown as WorkspaceInteractionCoordinatorService,
      keyboardFlow as unknown as KeyboardFlowUseCaseService
    );
    const event = { clientX: 12 } as MouseEvent;
    const containerElement = { id: 'workspace' } as HTMLDivElement;
    const elementRef = { nativeElement: containerElement } as ElementRef<HTMLDivElement>;

    // Action
    service.onWindowMouseMove(event, elementRef);
    service.onWindowMouseMove(event);

    // Assert
    expect(workspaceCoordinator.handleWindowMouseMove.calls.allArgs()).toEqual([
      [event, containerElement],
      [event, null]
    ]);
  });

  it('onWindowMouseUp should delegate to workspace coordinator', () => {
    // Arrange
    const workspaceCoordinator =
      ShellInputInteractionUseCaseMockFactory.createWorkspaceInteractionCoordinatorMock();
    const keyboardFlow = ShellInputInteractionUseCaseMockFactory.createKeyboardFlowUseCaseMock();
    const service = new ShellInputInteractionUseCaseService(
      workspaceCoordinator as unknown as WorkspaceInteractionCoordinatorService,
      keyboardFlow as unknown as KeyboardFlowUseCaseService
    );

    // Action
    service.onWindowMouseUp();

    // Assert
    expect(workspaceCoordinator.handleWindowMouseUp).toHaveBeenCalledTimes(1);
  });

  it('onWindowKeyDown should delegate params to keyboard flow use case', () => {
    // Arrange
    const workspaceCoordinator =
      ShellInputInteractionUseCaseMockFactory.createWorkspaceInteractionCoordinatorMock();
    const keyboardFlow = ShellInputInteractionUseCaseMockFactory.createKeyboardFlowUseCaseMock();
    const service = new ShellInputInteractionUseCaseService(
      workspaceCoordinator as unknown as WorkspaceInteractionCoordinatorService,
      keyboardFlow as unknown as KeyboardFlowUseCaseService
    );
    const event = { key: 'ArrowDown' } as KeyboardEvent;
    const selectedProperty = ShellInputInteractionUseCaseMockFactory.createProperty();
    const properties = [
      selectedProperty,
      ShellInputInteractionUseCaseMockFactory.createProperty({
        propertyId: 'p-2',
        title: 'Title 2'
      })
    ];
    const scroller = {
      scrollPropertyIntoView: jasmine.createSpy('scrollPropertyIntoView')
    };
    const onTogglePropertyReview = jasmine.createSpy('onTogglePropertyReview');
    const onTogglePropertyLocationDialog = jasmine.createSpy('onTogglePropertyLocationDialog');

    // Action
    service.onWindowKeyDown({
      event,
      activeTab: 'DASHBOARD',
      isAuthenticated: true,
      properties,
      selectedProperty,
      onTogglePropertyReview,
      onTogglePropertyLocationDialog,
      scroller
    });

    // Assert
    expect(keyboardFlow.handleWindowKeyDown).toHaveBeenCalledOnceWith({
      event,
      activeTab: 'DASHBOARD',
      isAuthenticated: true,
      properties,
      selectedProperty,
      onTogglePropertyReview,
      onTogglePropertyLocationDialog,
      scroller
    });
  });
});
