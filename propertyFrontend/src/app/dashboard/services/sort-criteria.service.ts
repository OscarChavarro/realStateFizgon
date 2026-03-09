import { Injectable } from '@angular/core';
import { SortCriterion, SortDirection, SortField } from 'src/app/dashboard/dashboard.types';

@Injectable({
  providedIn: 'root'
})
export class SortCriteriaService {
  toggleSortCriteria(
    currentCriteria: SortCriterion[],
    sortBy: SortField,
    sortOrder: SortDirection
  ): SortCriterion[] {
    const updated = [...currentCriteria];
    const existingIndex = updated.findIndex((criterion) => criterion.sortBy === sortBy);

    if (existingIndex < 0) {
      updated.push({ sortBy, sortOrder });
      return updated;
    }

    const existing = updated[existingIndex];
    if (existing.sortOrder === sortOrder) {
      updated.splice(existingIndex, 1);
      return updated;
    }

    updated[existingIndex] = { sortBy, sortOrder };
    return updated;
  }
}
