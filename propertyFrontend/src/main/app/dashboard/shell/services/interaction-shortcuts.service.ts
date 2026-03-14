import { Injectable } from '@angular/core';
import { DashboardPropertyRow, DashboardTab } from 'src/app/dashboard/dashboard.types';

export type PropertyRowScroller = {
  scrollPropertyIntoView(property: DashboardPropertyRow): void;
};

export type InteractionShortcutsContext = {
  event: KeyboardEvent;
  activeTab: DashboardTab;
  isAuthenticated: boolean;
  properties: DashboardPropertyRow[];
  selectedProperty: DashboardPropertyRow | null;
  onKeyboardSelect: (delta: -1 | 1) => DashboardPropertyRow | null;
  onToggleFullscreen: () => void;
  onTogglePropertyReview: (property: DashboardPropertyRow) => void;
  onScrollSelectedProperty: (property: DashboardPropertyRow | null) => void;
};

@Injectable({
  providedIn: 'root'
})
export class InteractionShortcutsService {
  handleWindowKeyDown(context: InteractionShortcutsContext): void {
    const { event } = context;
    const target = event.target as HTMLElement | null;
    if (this.isTypingTarget(target)) {
      return;
    }

    const isCtrlOrMetaFind = event.key.toLowerCase() === 'f' && (event.ctrlKey || event.metaKey);
    if (isCtrlOrMetaFind) {
      return;
    }

    const isPlainFullscreenToggle = event.key.toLowerCase() === 'f'
      && !event.ctrlKey
      && !event.metaKey
      && !event.altKey;
    if (isPlainFullscreenToggle) {
      if (event.repeat) {
        return;
      }
      event.preventDefault();
      context.onToggleFullscreen();
      return;
    }

    if (event.repeat || event.defaultPrevented) {
      return;
    }

    if (event.key === 'ArrowUp') {
      if (context.activeTab !== 'DASHBOARD') {
        return;
      }
      event.preventDefault();
      const selected = context.onKeyboardSelect(-1);
      context.onScrollSelectedProperty(selected);
      return;
    }

    if (event.key === 'ArrowDown') {
      if (context.activeTab !== 'DASHBOARD') {
        return;
      }
      event.preventDefault();
      const selected = context.onKeyboardSelect(1);
      context.onScrollSelectedProperty(selected);
      return;
    }

    if (event.code === 'Space' || event.key === ' ') {
      if (context.activeTab !== 'DASHBOARD' || !context.isAuthenticated) {
        return;
      }

      if (!context.selectedProperty) {
        return;
      }

      event.preventDefault();
      context.onTogglePropertyReview(context.selectedProperty);
    }
  }

  scrollSelectedPropertyRow(property: DashboardPropertyRow | null, scroller?: PropertyRowScroller): void {
    if (!property || !scroller) {
      return;
    }

    queueMicrotask(() => {
      scroller.scrollPropertyIntoView(property);
    });
  }

  private isTypingTarget(target: HTMLElement | null): boolean {
    if (!target) {
      return false;
    }

    const tagName = target.tagName.toLowerCase();
    return tagName === 'input'
      || tagName === 'textarea'
      || tagName === 'select'
      || target.isContentEditable;
  }
}
