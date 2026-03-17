import { GoogleMapProperty } from 'src/app/core/maps/model/google-map-property.model';

export type GoogleMapKeyboardSelectionResult =
  | { type: 'none' }
  | { type: 'selected'; property: GoogleMapProperty }
  | { type: 'closed' };

export class GoogleMapSelectionController {
  private selectedPropertySummary: GoogleMapProperty | null = null;

  getSelectedPropertySummary(): GoogleMapProperty | null {
    return this.selectedPropertySummary;
  }

  selectProperty(property: GoogleMapProperty): void {
    this.selectedPropertySummary = property;
  }

  clearSelection(): boolean {
    if (this.selectedPropertySummary === null) {
      return false;
    }

    this.selectedPropertySummary = null;
    return true;
  }

  syncSelectionAgainstProperties(properties: GoogleMapProperty[]): GoogleMapProperty | null {
    if (this.selectedPropertySummary === null) {
      return null;
    }

    const selected =
      properties.find((item) => item.id === this.selectedPropertySummary?.id) ?? null;
    this.selectedPropertySummary = selected;
    return selected;
  }

  handleKeyboardSelection(
    event: KeyboardEvent,
    interactionEnabled: boolean,
    mappableProperties: GoogleMapProperty[]
  ): GoogleMapKeyboardSelectionResult {
    if (!interactionEnabled || event.defaultPrevented || event.repeat) {
      return { type: 'none' };
    }

    if (event.ctrlKey || event.metaKey || event.altKey) {
      return { type: 'none' };
    }

    const target = event.target as HTMLElement | null;
    if (this.isTypingTarget(target)) {
      return { type: 'none' };
    }

    if (event.key === 'Escape') {
      if (this.clearSelection()) {
        event.preventDefault();
        return { type: 'closed' };
      }
      return { type: 'none' };
    }

    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
      return { type: 'none' };
    }

    if (mappableProperties.length === 0) {
      return { type: 'none' };
    }

    event.preventDefault();
    const delta: -1 | 1 = event.key === 'ArrowUp' ? -1 : 1;
    const selected = this.selectByKeyboard(delta, mappableProperties);
    if (!selected) {
      return { type: 'none' };
    }

    return { type: 'selected', property: selected };
  }

  private selectByKeyboard(
    delta: -1 | 1,
    mappableProperties: GoogleMapProperty[]
  ): GoogleMapProperty | null {
    if (mappableProperties.length === 0) {
      return null;
    }

    const currentId = this.selectedPropertySummary?.id ?? null;
    const currentIndex =
      currentId === null
        ? -1
        : mappableProperties.findIndex((property) => property.id === currentId);

    const startIndex = currentIndex >= 0 ? currentIndex : delta === 1 ? -1 : 0;
    const nextIndex = (startIndex + delta + mappableProperties.length) % mappableProperties.length;
    const selected = mappableProperties[nextIndex];

    this.selectedPropertySummary = selected;
    return selected;
  }

  private isTypingTarget(target: HTMLElement | null): boolean {
    if (!target) {
      return false;
    }

    const tagName = target.tagName.toLowerCase();
    return (
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select' ||
      target.isContentEditable
    );
  }
}
