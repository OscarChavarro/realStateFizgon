import type { FilterType } from 'domain/filters/filter-type';

export type FilterSnapshot = Readonly<{
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
