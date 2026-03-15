import { Injectable, signal } from '@angular/core';
import { ListingPropertyRow } from 'src/app/listing/model/listing.types';

@Injectable({
  providedIn: 'root'
})
export class PropertySelectionService {
  readonly selectedProperty = signal<ListingPropertyRow | null>(null);
  readonly lockedSelectedPropertyKey = signal<string | null>(null);

  onRowHover(property: ListingPropertyRow): void {
    if (this.lockedSelectedPropertyKey()) {
      return;
    }

    this.selectedProperty.set(property);
  }

  onRowClick(property: ListingPropertyRow): void {
    const rowKey = this.getPropertyRowKey(property);
    const currentLockedKey = this.lockedSelectedPropertyKey();

    if (currentLockedKey === rowKey) {
      this.lockedSelectedPropertyKey.set(null);
      return;
    }

    this.lockedSelectedPropertyKey.set(rowKey);
    this.selectedProperty.set(property);
  }

  syncAfterRefresh(rows: ListingPropertyRow[]): void {
    const lockedKey = this.lockedSelectedPropertyKey();
    if (lockedKey) {
      const lockedRow = rows.find((row) => this.getPropertyRowKey(row) === lockedKey);
      if (lockedRow) {
        this.selectedProperty.set(lockedRow);
      } else {
        this.lockedSelectedPropertyKey.set(null);
      }
      return;
    }

    const selected = this.selectedProperty();
    if (selected) {
      const selectedKey = this.getPropertyRowKey(selected);
      const matchingRow = rows.find((row) => this.getPropertyRowKey(row) === selectedKey);
      if (matchingRow) {
        this.selectedProperty.set(matchingRow);
        return;
      }
    }

    this.selectedProperty.set(rows.length > 0 ? rows[0] : null);
  }

  selectByKeyboard(rows: ListingPropertyRow[], delta: -1 | 1): ListingPropertyRow | null {
    if (rows.length === 0) {
      return null;
    }

    const lockedKey = this.lockedSelectedPropertyKey();
    const selected = this.selectedProperty();
    let currentIndex = -1;

    if (lockedKey) {
      currentIndex = rows.findIndex((row) => this.getPropertyRowKey(row) === lockedKey);
    } else if (selected) {
      const selectedKey = this.getPropertyRowKey(selected);
      currentIndex = rows.findIndex((row) => this.getPropertyRowKey(row) === selectedKey);
    }

    if (currentIndex < 0) {
      currentIndex = 0;
    }

    const nextIndex = Math.min(rows.length - 1, Math.max(0, currentIndex + delta));
    const nextRow = rows[nextIndex];
    const nextKey = this.getPropertyRowKey(nextRow);

    this.selectedProperty.set(nextRow);
    this.lockedSelectedPropertyKey.set(nextKey);
    return nextRow;
  }

  private getPropertyRowKey(property: ListingPropertyRow): string {
    return `${property.propertyId}|${property.url}|${property.publicationDate}|${property.title}`;
  }
}
