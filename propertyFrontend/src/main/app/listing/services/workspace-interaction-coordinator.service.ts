import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { ApiRuntimeConfigService } from 'src/app/core/api/services/api-runtime-config.service';
import { ListingPropertyRow, ListingTab } from 'src/app/listing/model/listing.types';
import { BrowserFullscreenService } from 'src/app/listing/services/browser-fullscreen.service';
import { PropertySelectionService } from 'src/app/listing/services/property-selection.service';
import { WorkspaceLayoutService } from 'src/app/listing/services/workspace-layout.service';
import {
  InteractionShortcutsService,
  PropertyRowScroller
} from 'src/app/listing/services/interaction-shortcuts.service';

type HandleWindowKeyDownParams = {
  event: KeyboardEvent;
  activeTab: ListingTab;
  isAuthenticated: boolean;
  properties: ListingPropertyRow[];
  selectedProperty: ListingPropertyRow | null;
  onTogglePropertyReview: (property: ListingPropertyRow) => void;
  onTogglePropertyLocationDialog: () => void;
  scroller?: PropertyRowScroller;
};

@Injectable({
  providedIn: 'root'
})
export class WorkspaceInteractionCoordinatorService {
  private socket: Socket | null = null;

  readonly leftPanelWidthPercent = this.workspaceLayoutService.leftPanelWidthPercent;
  readonly leftPanelHidden = this.workspaceLayoutService.leftPanelHidden;
  readonly rightPanelHidden = this.workspaceLayoutService.rightPanelHidden;

  constructor(
    private readonly workspaceLayoutService: WorkspaceLayoutService,
    private readonly interactionShortcutsService: InteractionShortcutsService,
    private readonly browserFullscreenService: BrowserFullscreenService,
    private readonly propertySelectionService: PropertySelectionService,
    private readonly apiRuntimeConfigService: ApiRuntimeConfigService
  ) {}

  connectUpdatesSocket(onPropertiesCountUpdated: () => Promise<void>): void {
    this.disconnectUpdatesSocket();
    this.socket = this.createSocket();
    this.socket.on('properties-count-updated', async () => {
      await onPropertiesCountUpdated();
    });
  }

  disconnectUpdatesSocket(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  startResize(event: MouseEvent): void {
    this.workspaceLayoutService.startResize(event);
  }

  cycleLayout(): void {
    this.workspaceLayoutService.cycleLayout();
  }

  getWorkspaceColumns(): string {
    return this.workspaceLayoutService.getWorkspaceColumns();
  }

  getCycleIcon(): string {
    return this.workspaceLayoutService.getCycleIcon();
  }

  handleWindowMouseMove(event: MouseEvent, container: HTMLDivElement | null): void {
    this.workspaceLayoutService.updateResizeFromMouse(event, container);
  }

  handleWindowMouseUp(): void {
    this.workspaceLayoutService.stopResize();
  }

  handleWindowKeyDown(params: HandleWindowKeyDownParams): void {
    this.interactionShortcutsService.handleWindowKeyDown({
      event: params.event,
      activeTab: params.activeTab,
      isAuthenticated: params.isAuthenticated,
      properties: params.properties,
      selectedProperty: params.selectedProperty,
      onKeyboardSelect: (delta) =>
        this.propertySelectionService.selectByKeyboard(params.properties, delta),
      onToggleFullscreen: () => {
        void this.browserFullscreenService.toggleFullscreen();
      },
      onTogglePropertyReview: params.onTogglePropertyReview,
      onTogglePropertyLocationDialog: params.onTogglePropertyLocationDialog,
      onScrollSelectedProperty: (property) => {
        this.interactionShortcutsService.scrollSelectedPropertyRow(property, params.scroller);
      }
    });
  }

  toggleFullscreen(): void {
    void this.browserFullscreenService.toggleFullscreen();
  }

  private createSocket(): Socket {
    return io(this.apiRuntimeConfigService.getBackendBaseUrl());
  }
}
