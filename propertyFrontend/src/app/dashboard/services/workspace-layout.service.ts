import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class WorkspaceLayoutService {
  private static readonly SPLITTER_WIDTH_PX = 8;
  private isResizingWorkspace = false;

  readonly leftPanelWidthPercent = signal<number>(50);
  readonly leftPanelHidden = signal<boolean>(false);
  readonly rightPanelHidden = signal<boolean>(false);

  startResize(event: MouseEvent): void {
    if (this.leftPanelHidden() || this.rightPanelHidden()) {
      return;
    }

    this.isResizingWorkspace = true;
    event.preventDefault();
  }

  updateResizeFromMouse(event: MouseEvent, containerElement: HTMLDivElement | null): void {
    if (!this.isResizingWorkspace || !containerElement) {
      return;
    }

    const rect = containerElement.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }

    const cursorX = event.clientX - rect.left;
    const rawPercent = (cursorX / rect.width) * 100;
    const clamped = Math.min(85, Math.max(15, rawPercent));
    this.leftPanelWidthPercent.set(clamped);
  }

  stopResize(): void {
    this.isResizingWorkspace = false;
  }

  cycleLayout(): void {
    const leftHidden = this.leftPanelHidden();
    const rightHidden = this.rightPanelHidden();

    if (!leftHidden && !rightHidden) {
      this.rightPanelHidden.set(true);
      this.leftPanelHidden.set(false);
      return;
    }

    if (!leftHidden && rightHidden) {
      this.leftPanelHidden.set(true);
      this.rightPanelHidden.set(false);
      return;
    }

    this.leftPanelHidden.set(false);
    this.rightPanelHidden.set(false);
  }

  getWorkspaceColumns(): string {
    const splitterWidth = WorkspaceLayoutService.SPLITTER_WIDTH_PX;
    if (this.leftPanelHidden() && !this.rightPanelHidden()) {
      return `0 ${splitterWidth}px minmax(0, 1fr)`;
    }

    if (this.rightPanelHidden() && !this.leftPanelHidden()) {
      return `minmax(0, 1fr) ${splitterWidth}px 0`;
    }

    const left = this.leftPanelWidthPercent();
    const right = 100 - left;
    return `minmax(280px, ${left}%) ${splitterWidth}px minmax(280px, ${right}%)`;
  }

  getCycleIcon(): string {
    if (!this.leftPanelHidden() && !this.rightPanelHidden()) {
      return 'vertical_split';
    }

    if (!this.leftPanelHidden() && this.rightPanelHidden()) {
      return 'left_panel_open';
    }

    return 'right_panel_open';
  }
}
