import type { FilterType } from 'domain/filters/filter-type';
import type { FilterId } from 'domain/filters/filter-id';

export type FilterSnapshot = Readonly<{
  id: FilterId;
  name: string;
  cssSelector: string;
  type: FilterType;
  plainOptions: readonly string[];
  selectedPlainOptions: readonly string[];
  minOptions: readonly string[];
  maxOptions: readonly string[];
  selectedMin: string | null;
  selectedMax: string | null;
}>;
