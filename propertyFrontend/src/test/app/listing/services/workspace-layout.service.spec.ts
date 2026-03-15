import { WorkspaceLayoutService } from 'src/app/listing/services/workspace-layout.service';

describe('WorkspaceLayoutService', () => {
  let service: WorkspaceLayoutService;

  beforeEach(() => {
    service = new WorkspaceLayoutService();
  });

  it('startResize should prevent default and enable resizing when both panels are visible', () => {
    // Arrange
    const event = { preventDefault: jasmine.createSpy('preventDefault') } as unknown as MouseEvent;

    // Action
    service.startResize(event);
    service.updateResizeFromMouse({ clientX: 100 } as MouseEvent, {
      getBoundingClientRect: () => ({ left: 0, width: 200 } as DOMRect)
    } as HTMLDivElement);

    // Assert
    expect((event.preventDefault as jasmine.Spy)).toHaveBeenCalled();
    expect(service.leftPanelWidthPercent()).toBe(50);
  });

  [
    { leftHidden: true, rightHidden: false },
    { leftHidden: false, rightHidden: true }
  ].forEach(({ leftHidden, rightHidden }) => {
    it(`startResize should skip resizing when hidden state is left=${leftHidden} right=${rightHidden}`, () => {
      // Arrange
      const event = { preventDefault: jasmine.createSpy('preventDefault') } as unknown as MouseEvent;
      service.leftPanelHidden.set(leftHidden);
      service.rightPanelHidden.set(rightHidden);

      // Action
      service.startResize(event);
      service.updateResizeFromMouse({ clientX: 20 } as MouseEvent, {
        getBoundingClientRect: () => ({ left: 0, width: 200 } as DOMRect)
      } as HTMLDivElement);

      // Assert
      expect((event.preventDefault as jasmine.Spy)).not.toHaveBeenCalled();
      expect(service.leftPanelWidthPercent()).toBe(50);
    });
  });

  it('updateResizeFromMouse should return when container is null', () => {
    // Arrange
    const event = { preventDefault: jasmine.createSpy('preventDefault') } as unknown as MouseEvent;
    service.startResize(event);

    // Action
    service.updateResizeFromMouse({ clientX: 50 } as MouseEvent, null);

    // Assert
    expect(service.leftPanelWidthPercent()).toBe(50);
  });

  it('updateResizeFromMouse should return when container width is zero', () => {
    // Arrange
    const event = { preventDefault: jasmine.createSpy('preventDefault') } as unknown as MouseEvent;
    service.startResize(event);

    // Action
    service.updateResizeFromMouse({ clientX: 50 } as MouseEvent, {
      getBoundingClientRect: () => ({ left: 0, width: 0 } as DOMRect)
    } as HTMLDivElement);

    // Assert
    expect(service.leftPanelWidthPercent()).toBe(50);
  });

  [
    { clientX: -10, expected: 15 },
    { clientX: 50, expected: 50 },
    { clientX: 500, expected: 85 }
  ].forEach(({ clientX, expected }) => {
    it(`updateResizeFromMouse should clamp width percent to ${expected}`, () => {
      // Arrange
      const event = { preventDefault: jasmine.createSpy('preventDefault') } as unknown as MouseEvent;
      service.startResize(event);

      // Action
      service.updateResizeFromMouse({ clientX } as MouseEvent, {
        getBoundingClientRect: () => ({ left: 0, width: 100 } as DOMRect)
      } as HTMLDivElement);

      // Assert
      expect(service.leftPanelWidthPercent()).toBe(expected);
    });
  });

  it('stopResize should disable resizing', () => {
    // Arrange
    const event = { preventDefault: jasmine.createSpy('preventDefault') } as unknown as MouseEvent;
    service.startResize(event);
    service.stopResize();

    // Action
    service.updateResizeFromMouse({ clientX: 80 } as MouseEvent, {
      getBoundingClientRect: () => ({ left: 0, width: 100 } as DOMRect)
    } as HTMLDivElement);

    // Assert
    expect(service.leftPanelWidthPercent()).toBe(50);
  });

  it('cycleLayout should hide right panel from split mode', () => {
    // Arrange
    service.leftPanelHidden.set(false);
    service.rightPanelHidden.set(false);

    // Action
    service.cycleLayout();

    // Assert
    expect(service.leftPanelHidden()).toBeFalse();
    expect(service.rightPanelHidden()).toBeTrue();
  });

  it('cycleLayout should hide left panel from right hidden mode', () => {
    // Arrange
    service.leftPanelHidden.set(false);
    service.rightPanelHidden.set(true);

    // Action
    service.cycleLayout();

    // Assert
    expect(service.leftPanelHidden()).toBeTrue();
    expect(service.rightPanelHidden()).toBeFalse();
  });

  it('cycleLayout should restore split mode from left hidden mode', () => {
    // Arrange
    service.leftPanelHidden.set(true);
    service.rightPanelHidden.set(false);

    // Action
    service.cycleLayout();

    // Assert
    expect(service.leftPanelHidden()).toBeFalse();
    expect(service.rightPanelHidden()).toBeFalse();
  });

  it('getWorkspaceColumns should return right-only layout when left panel is hidden', () => {
    // Arrange
    service.leftPanelHidden.set(true);
    service.rightPanelHidden.set(false);

    // Action
    const columns = service.getWorkspaceColumns();

    // Assert
    expect(columns).toBe('0 8px minmax(0, 1fr)');
  });

  it('getWorkspaceColumns should return left-only layout when right panel is hidden', () => {
    // Arrange
    service.leftPanelHidden.set(false);
    service.rightPanelHidden.set(true);

    // Action
    const columns = service.getWorkspaceColumns();

    // Assert
    expect(columns).toBe('minmax(0, 1fr) 8px 0');
  });

  it('getWorkspaceColumns should return split layout when both panels are visible', () => {
    // Arrange
    service.leftPanelHidden.set(false);
    service.rightPanelHidden.set(false);
    service.leftPanelWidthPercent.set(42);

    // Action
    const columns = service.getWorkspaceColumns();

    // Assert
    expect(columns).toBe('minmax(280px, 42%) 8px minmax(280px, 58%)');
  });

  [
    { leftHidden: false, rightHidden: false, expected: 'vertical_split' },
    { leftHidden: false, rightHidden: true, expected: 'left_panel_open' },
    { leftHidden: true, rightHidden: false, expected: 'right_panel_open' }
  ].forEach(({ leftHidden, rightHidden, expected }) => {
    it(`getCycleIcon should return ${expected}`, () => {
      // Arrange
      service.leftPanelHidden.set(leftHidden);
      service.rightPanelHidden.set(rightHidden);

      // Action
      const icon = service.getCycleIcon();

      // Assert
      expect(icon).toBe(expected);
    });
  });
});
