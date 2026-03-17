import { TestBed } from '@angular/core/testing';
import { ApiRuntimeConfigService } from 'src/app/core/api/services/api-runtime-config.service';
import { InteractionShortcutsService } from 'src/app/listing/services/interaction-shortcuts.service';
import { BrowserFullscreenService } from 'src/app/listing/services/browser-fullscreen.service';
import { PropertySelectionService } from 'src/app/listing/services/property-selection.service';
import { WorkspaceInteractionCoordinatorService } from 'src/app/listing/services/workspace-interaction-coordinator.service';
import { WorkspaceLayoutService } from 'src/app/listing/services/workspace-layout.service';

class WorkspaceInteractionCoordinatorMockFactory {
  static createWorkspaceLayoutServiceMock() {
    return {
      leftPanelWidthPercent: jasmine.createSpy('leftPanelWidthPercent').and.returnValue(50),
      leftPanelHidden: jasmine.createSpy('leftPanelHidden').and.returnValue(false),
      rightPanelHidden: jasmine.createSpy('rightPanelHidden').and.returnValue(false),
      startResize: jasmine.createSpy('startResize'),
      cycleLayout: jasmine.createSpy('cycleLayout'),
      getWorkspaceColumns: jasmine
        .createSpy('getWorkspaceColumns')
        .and.returnValue('grid-template'),
      getCycleIcon: jasmine.createSpy('getCycleIcon').and.returnValue('vertical_split'),
      updateResizeFromMouse: jasmine.createSpy('updateResizeFromMouse'),
      stopResize: jasmine.createSpy('stopResize')
    };
  }

  static createInteractionShortcutsServiceMock() {
    return {
      handleWindowKeyDown: jasmine.createSpy('handleWindowKeyDown'),
      scrollSelectedPropertyRow: jasmine.createSpy('scrollSelectedPropertyRow')
    };
  }

  static createBrowserFullscreenServiceMock() {
    return {
      toggleFullscreen: jasmine.createSpy('toggleFullscreen').and.resolveTo(undefined)
    };
  }

  static createPropertySelectionServiceMock() {
    return {
      selectByKeyboard: jasmine.createSpy('selectByKeyboard').and.returnValue(null)
    };
  }

  static createApiRuntimeConfigServiceMock() {
    return {
      getBackendBaseUrl: jasmine
        .createSpy('getBackendBaseUrl')
        .and.returnValue('http://localhost:8081')
    };
  }
}

describe('WorkspaceInteractionCoordinatorService', () => {
  let service: WorkspaceInteractionCoordinatorService;
  let workspaceLayoutServiceMock: ReturnType<
    typeof WorkspaceInteractionCoordinatorMockFactory.createWorkspaceLayoutServiceMock
  >;
  let interactionShortcutsServiceMock: ReturnType<
    typeof WorkspaceInteractionCoordinatorMockFactory.createInteractionShortcutsServiceMock
  >;
  let browserFullscreenServiceMock: ReturnType<
    typeof WorkspaceInteractionCoordinatorMockFactory.createBrowserFullscreenServiceMock
  >;
  let propertySelectionServiceMock: ReturnType<
    typeof WorkspaceInteractionCoordinatorMockFactory.createPropertySelectionServiceMock
  >;
  let apiRuntimeConfigServiceMock: ReturnType<
    typeof WorkspaceInteractionCoordinatorMockFactory.createApiRuntimeConfigServiceMock
  >;

  beforeEach(() => {
    workspaceLayoutServiceMock =
      WorkspaceInteractionCoordinatorMockFactory.createWorkspaceLayoutServiceMock();
    interactionShortcutsServiceMock =
      WorkspaceInteractionCoordinatorMockFactory.createInteractionShortcutsServiceMock();
    browserFullscreenServiceMock =
      WorkspaceInteractionCoordinatorMockFactory.createBrowserFullscreenServiceMock();
    propertySelectionServiceMock =
      WorkspaceInteractionCoordinatorMockFactory.createPropertySelectionServiceMock();
    apiRuntimeConfigServiceMock =
      WorkspaceInteractionCoordinatorMockFactory.createApiRuntimeConfigServiceMock();

    TestBed.configureTestingModule({
      providers: [
        WorkspaceInteractionCoordinatorService,
        { provide: WorkspaceLayoutService, useValue: workspaceLayoutServiceMock },
        { provide: InteractionShortcutsService, useValue: interactionShortcutsServiceMock },
        { provide: BrowserFullscreenService, useValue: browserFullscreenServiceMock },
        { provide: PropertySelectionService, useValue: propertySelectionServiceMock },
        { provide: ApiRuntimeConfigService, useValue: apiRuntimeConfigServiceMock }
      ]
    });

    service = TestBed.inject(WorkspaceInteractionCoordinatorService);
  });

  it('connectUpdatesSocket should create socket and refresh on properties-count-updated', async () => {
    // Arrange
    const disconnectSpy = jasmine.createSpy('disconnect');
    const socketMock = {
      on: jasmine.createSpy('on'),
      disconnect: disconnectSpy
    };
    const createSocketSpy = spyOn<any>(service, 'createSocket').and.returnValue(socketMock as any);
    const refreshSpy = jasmine.createSpy('refresh').and.resolveTo(undefined);

    // Action
    service.connectUpdatesSocket(refreshSpy);
    const updatesHandler = socketMock.on.calls.mostRecent().args[1] as () => Promise<void>;
    await updatesHandler();

    // Assert
    expect(createSocketSpy).toHaveBeenCalled();
    expect(socketMock.on).toHaveBeenCalled();
    expect(refreshSpy).toHaveBeenCalled();
  });

  it('connectUpdatesSocket should disconnect previous socket before connecting a new one', () => {
    // Arrange
    const oldDisconnectSpy = jasmine.createSpy('oldDisconnect');
    const firstSocket = {
      on: jasmine.createSpy('on'),
      disconnect: oldDisconnectSpy
    };
    const secondSocket = {
      on: jasmine.createSpy('on'),
      disconnect: jasmine.createSpy('disconnect')
    };
    spyOn<any>(service, 'createSocket').and.returnValues(firstSocket as any, secondSocket as any);

    // Action
    service.connectUpdatesSocket(async () => undefined);
    service.connectUpdatesSocket(async () => undefined);

    // Assert
    expect(oldDisconnectSpy).toHaveBeenCalled();
  });

  it('disconnectUpdatesSocket should clear socket reference and disconnect when socket exists', () => {
    // Arrange
    const socketMock = {
      on: jasmine.createSpy('on'),
      disconnect: jasmine.createSpy('disconnect')
    };
    spyOn<any>(service, 'createSocket').and.returnValue(socketMock as any);
    service.connectUpdatesSocket(async () => undefined);

    // Action
    service.disconnectUpdatesSocket();
    service.disconnectUpdatesSocket();

    // Assert
    expect(socketMock.disconnect).toHaveBeenCalledTimes(1);
  });

  it('should expose layout signals from workspace layout service', () => {
    // Arrange

    // Action
    const leftWidth = service.leftPanelWidthPercent();
    const leftHidden = service.leftPanelHidden();
    const rightHidden = service.rightPanelHidden();

    // Assert
    expect(leftWidth).toBe(50);
    expect(leftHidden).toBeFalse();
    expect(rightHidden).toBeFalse();
  });

  it('startResize should delegate to workspace layout service', () => {
    // Arrange
    const event = new MouseEvent('mousedown');

    // Action
    service.startResize(event);

    // Assert
    expect(workspaceLayoutServiceMock.startResize).toHaveBeenCalledOnceWith(event);
  });

  it('cycleLayout should delegate to workspace layout service', () => {
    // Arrange

    // Action
    service.cycleLayout();

    // Assert
    expect(workspaceLayoutServiceMock.cycleLayout).toHaveBeenCalled();
  });

  it('getWorkspaceColumns should delegate to workspace layout service', () => {
    // Arrange

    // Action
    const result = service.getWorkspaceColumns();

    // Assert
    expect(result).toBe('grid-template');
    expect(workspaceLayoutServiceMock.getWorkspaceColumns).toHaveBeenCalled();
  });

  it('getCycleIcon should delegate to workspace layout service', () => {
    // Arrange

    // Action
    const result = service.getCycleIcon();

    // Assert
    expect(result).toBe('vertical_split');
    expect(workspaceLayoutServiceMock.getCycleIcon).toHaveBeenCalled();
  });

  it('handleWindowMouseMove should delegate to workspace layout service', () => {
    // Arrange
    const event = new MouseEvent('mousemove');
    const container = document.createElement('div');

    // Action
    service.handleWindowMouseMove(event, container);

    // Assert
    expect(workspaceLayoutServiceMock.updateResizeFromMouse).toHaveBeenCalledOnceWith(
      event,
      container
    );
  });

  it('handleWindowMouseUp should delegate to workspace layout service', () => {
    // Arrange

    // Action
    service.handleWindowMouseUp();

    // Assert
    expect(workspaceLayoutServiceMock.stopResize).toHaveBeenCalled();
  });

  it('handleWindowKeyDown should delegate and wire callbacks', () => {
    // Arrange
    const selectedProperty = {
      propertyId: 'p-1',
      publicationDate: '',
      publicationDateShort: '',
      title: '',
      url: '',
      price: '',
      location: '',
      advertiserComment: '',
      localImageUrls: [],
      unavailable: false,
      geoLocationHint: null
    };
    propertySelectionServiceMock.selectByKeyboard.and.returnValue(selectedProperty as any);
    const reviewSpy = jasmine.createSpy('onTogglePropertyReview');
    const locationSpy = jasmine.createSpy('onTogglePropertyLocationDialog');
    const scroller = { scrollPropertyIntoView: jasmine.createSpy('scrollPropertyIntoView') };
    const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });

    // Action
    service.handleWindowKeyDown({
      event,
      activeTab: 'DASHBOARD',
      isAuthenticated: true,
      properties: [selectedProperty as any],
      selectedProperty: selectedProperty as any,
      onTogglePropertyReview: reviewSpy,
      onTogglePropertyLocationDialog: locationSpy,
      scroller
    });
    const delegatedContext =
      interactionShortcutsServiceMock.handleWindowKeyDown.calls.mostRecent().args[0];
    delegatedContext.onKeyboardSelect(1);
    delegatedContext.onToggleFullscreen();
    delegatedContext.onTogglePropertyReview(selectedProperty);
    delegatedContext.onTogglePropertyLocationDialog();
    delegatedContext.onScrollSelectedProperty(selectedProperty);

    // Assert
    expect(interactionShortcutsServiceMock.handleWindowKeyDown).toHaveBeenCalled();
    expect(propertySelectionServiceMock.selectByKeyboard).toHaveBeenCalledWith(
      [selectedProperty],
      1
    );
    expect(browserFullscreenServiceMock.toggleFullscreen).toHaveBeenCalled();
    expect(reviewSpy).toHaveBeenCalledWith(selectedProperty);
    expect(locationSpy).toHaveBeenCalled();
    expect(interactionShortcutsServiceMock.scrollSelectedPropertyRow).toHaveBeenCalledWith(
      selectedProperty,
      scroller
    );
  });

  it('toggleFullscreen should delegate to browser fullscreen service', () => {
    // Arrange

    // Action
    service.toggleFullscreen();

    // Assert
    expect(browserFullscreenServiceMock.toggleFullscreen).toHaveBeenCalled();
  });

  it('createSocket should build a socket instance using configured backend URL', () => {
    // Arrange

    // Action
    const socket = (service as any).createSocket();
    socket.disconnect();

    // Assert
    expect(apiRuntimeConfigServiceMock.getBackendBaseUrl).toHaveBeenCalled();
    expect(socket).toBeTruthy();
  });
});
