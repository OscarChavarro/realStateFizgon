import { Injectable } from '@angular/core';
import { SortCriterion, SortField } from 'src/app/listing/model/listing.types';

@Injectable({
  providedIn: 'root'
})
export class SortCriteriaService {
  cycleSortCriteria(currentCriteria: SortCriterion[], sortBy: SortField): SortCriterion[] {
    const updated = [...currentCriteria];
    const existingIndex = updated.findIndex((criterion) => criterion.sortBy === sortBy);

    if (existingIndex < 0) {
      updated.push({ sortBy, sortOrder: 'asc' });
      return updated;
    }

    const existing = updated[existingIndex];
    if (existing.sortOrder === 'asc') {
      updated[existingIndex] = { sortBy, sortOrder: 'desc' };
      return updated;
    }

    if (existing.sortOrder === 'desc') {
      updated.splice(existingIndex, 1);
      return updated;
    }

    updated[existingIndex] = { sortBy, sortOrder: 'asc' };
    return updated;
  }
}
