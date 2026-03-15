import { SortCriterion } from 'src/app/listing/model/listing.types';
import { SortCriteriaService } from 'src/app/listing/services/sort-criteria.service';

describe('SortCriteriaService', () => {
  let service: SortCriteriaService;

  beforeEach(() => {
    service = new SortCriteriaService();
  });

  it('cycleSortCriteria should append ascending criterion when field is absent', () => {
    // Arrange
    const current: SortCriterion[] = [];

    // Action
    const result = service.cycleSortCriteria(current, 'title');

    // Assert
    expect(result).toEqual([{ sortBy: 'title', sortOrder: 'asc' }]);
    expect(current).toEqual([]);
  });

  it('cycleSortCriteria should switch criterion from asc to desc', () => {
    // Arrange
    const current: SortCriterion[] = [{ sortBy: 'title', sortOrder: 'asc' }];

    // Action
    const result = service.cycleSortCriteria(current, 'title');

    // Assert
    expect(result).toEqual([{ sortBy: 'title', sortOrder: 'desc' }]);
  });

  it('cycleSortCriteria should remove criterion when current order is desc', () => {
    // Arrange
    const current: SortCriterion[] = [
      { sortBy: 'title', sortOrder: 'desc' },
      { sortBy: 'price', sortOrder: 'asc' }
    ];

    // Action
    const result = service.cycleSortCriteria(current, 'title');

    // Assert
    expect(result).toEqual([{ sortBy: 'price', sortOrder: 'asc' }]);
  });

  it('cycleSortCriteria should set fallback asc when runtime sort order is unknown', () => {
    // Arrange
    const current = [{ sortBy: 'title', sortOrder: 'invalid' }] as unknown as SortCriterion[];

    // Action
    const result = service.cycleSortCriteria(current, 'title');

    // Assert
    expect(result).toEqual([{ sortBy: 'title', sortOrder: 'asc' }]);
  });
});
