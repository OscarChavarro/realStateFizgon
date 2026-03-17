import { ListingPropertyRow } from 'src/app/listing/model/listing.types';
import { PropertySelectionService } from 'src/app/listing/services/property-selection.service';

class PropertySelectionMockFactory {
  static createRow(overrides: Partial<ListingPropertyRow> = {}): ListingPropertyRow {
    return {
      propertyId: 'id-1',
      publicationDate: '2026-03-15T00:00:00.000Z',
      publicationDateShort: '2026-03-15',
      title: 'Property title',
      url: 'https://example.com/property/1',
      price: '1200',
      location: 'Madrid',
      advertiserComment: 'comment',
      localImageUrls: [],
      unavailable: false,
      geoLocationHint: null,
      ...overrides
    };
  }
}

describe('PropertySelectionService', () => {
  let service: PropertySelectionService;

  beforeEach(() => {
    service = new PropertySelectionService();
  });

  it('onRowHover should set selected property when row is not locked', () => {
    // Arrange
    const row = PropertySelectionMockFactory.createRow({ propertyId: 'hover-1' });

    // Action
    service.onRowHover(row);

    // Assert
    expect(service.selectedProperty()).toEqual(row);
  });

  it('onRowHover should not change selected property when row is locked', () => {
    // Arrange
    const lockedRow = PropertySelectionMockFactory.createRow({ propertyId: 'locked' });
    service.onRowClick(lockedRow);
    const previous = service.selectedProperty();

    // Action
    service.onRowHover(PropertySelectionMockFactory.createRow({ propertyId: 'hover-2' }));

    // Assert
    expect(service.selectedProperty()).toEqual(previous);
  });

  it('onRowClick should lock and select row when clicking unlocked row', () => {
    // Arrange
    const row = PropertySelectionMockFactory.createRow({ propertyId: 'click-1' });

    // Action
    service.onRowClick(row);

    // Assert
    expect(service.selectedProperty()).toEqual(row);
    expect(service.lockedSelectedPropertyKey()).toContain('click-1|');
  });

  it('onRowClick should unlock row when clicking the same locked row', () => {
    // Arrange
    const row = PropertySelectionMockFactory.createRow({ propertyId: 'click-2' });
    service.onRowClick(row);

    // Action
    service.onRowClick(row);

    // Assert
    expect(service.lockedSelectedPropertyKey()).toBeNull();
  });

  it('syncAfterRefresh should keep matching locked row selected', () => {
    // Arrange
    const lockedRow = PropertySelectionMockFactory.createRow({ propertyId: 'locked-refresh' });
    const refreshedRow = PropertySelectionMockFactory.createRow({
      propertyId: 'locked-refresh',
      price: '1900'
    });
    service.onRowClick(lockedRow);

    // Action
    service.syncAfterRefresh([refreshedRow]);

    // Assert
    expect(service.selectedProperty()).toEqual(refreshedRow);
  });

  it('syncAfterRefresh should clear lock when locked row is missing after refresh', () => {
    // Arrange
    service.onRowClick(PropertySelectionMockFactory.createRow({ propertyId: 'locked-missing' }));
    const anotherRow = PropertySelectionMockFactory.createRow({ propertyId: 'another' });

    // Action
    service.syncAfterRefresh([anotherRow]);

    // Assert
    expect(service.lockedSelectedPropertyKey()).toBeNull();
  });

  it('syncAfterRefresh should update selected property when unlocked selected row still exists', () => {
    // Arrange
    const row = PropertySelectionMockFactory.createRow({ propertyId: 'selected-unlocked' });
    service.selectedProperty.set(row);
    service.lockedSelectedPropertyKey.set(null);
    const updated = PropertySelectionMockFactory.createRow({
      propertyId: 'selected-unlocked',
      price: '2100'
    });

    // Action
    service.syncAfterRefresh([updated]);

    // Assert
    expect(service.selectedProperty()).toEqual(updated);
    expect(service.lockedSelectedPropertyKey()).toBeNull();
  });

  [
    { rows: [] as ListingPropertyRow[], expectedPropertyId: null, expectedLockNull: true },
    {
      rows: [PropertySelectionMockFactory.createRow({ propertyId: 'first-row' })],
      expectedPropertyId: 'first-row',
      expectedLockNull: false
    }
  ].forEach(({ rows, expectedPropertyId, expectedLockNull }) => {
    it(`syncAfterRefresh should fallback to first row strategy for rows length ${rows.length}`, () => {
      // Arrange
      service.selectedProperty.set(
        PropertySelectionMockFactory.createRow({ propertyId: 'missing-selected' })
      );
      service.lockedSelectedPropertyKey.set(null);

      // Action
      service.syncAfterRefresh(rows);

      // Assert
      expect(service.selectedProperty()?.propertyId ?? null).toBe(expectedPropertyId);
      if (expectedLockNull) {
        expect(service.lockedSelectedPropertyKey()).toBeNull();
      } else {
        expect(service.lockedSelectedPropertyKey()).toContain('first-row|');
      }
    });
  });

  it('selectByKeyboard should return null when rows are empty', () => {
    // Arrange

    // Action
    const result = service.selectByKeyboard([], 1);

    // Assert
    expect(result).toBeNull();
  });

  it('selectByKeyboard should use locked index when lock exists', () => {
    // Arrange
    const rows = [
      PropertySelectionMockFactory.createRow({ propertyId: 'r1' }),
      PropertySelectionMockFactory.createRow({ propertyId: 'r2' }),
      PropertySelectionMockFactory.createRow({ propertyId: 'r3' })
    ];
    service.onRowClick(rows[1]);

    // Action
    const result = service.selectByKeyboard(rows, 1);

    // Assert
    expect(result).toEqual(rows[2]);
    expect(service.selectedProperty()).toEqual(rows[2]);
    expect(service.lockedSelectedPropertyKey()).toContain('r3|');
  });

  it('selectByKeyboard should use selected index when no lock exists', () => {
    // Arrange
    const rows = [
      PropertySelectionMockFactory.createRow({ propertyId: 'a1' }),
      PropertySelectionMockFactory.createRow({ propertyId: 'a2' }),
      PropertySelectionMockFactory.createRow({ propertyId: 'a3' })
    ];
    service.selectedProperty.set(rows[1]);
    service.lockedSelectedPropertyKey.set(null);

    // Action
    const result = service.selectByKeyboard(rows, -1);

    // Assert
    expect(result).toEqual(rows[0]);
    expect(service.lockedSelectedPropertyKey()).toContain('a1|');
  });

  it('selectByKeyboard should fallback to index zero when current selection is not found', () => {
    // Arrange
    const rows = [
      PropertySelectionMockFactory.createRow({ propertyId: 'b1' }),
      PropertySelectionMockFactory.createRow({ propertyId: 'b2' })
    ];
    service.selectedProperty.set(PropertySelectionMockFactory.createRow({ propertyId: 'missing' }));
    service.lockedSelectedPropertyKey.set(null);

    // Action
    const result = service.selectByKeyboard(rows, 1);

    // Assert
    expect(result).toEqual(rows[1]);
  });

  it('selectByKeyboard should clamp next index at boundaries', () => {
    // Arrange
    const rows = [
      PropertySelectionMockFactory.createRow({ propertyId: 'c1' }),
      PropertySelectionMockFactory.createRow({ propertyId: 'c2' })
    ];
    service.selectedProperty.set(rows[0]);
    service.lockedSelectedPropertyKey.set(null);

    // Action
    const result = service.selectByKeyboard(rows, -1);

    // Assert
    expect(result).toEqual(rows[0]);
  });
});
