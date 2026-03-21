import { FilterType } from 'domain/filters/filter-type';
import type { FilterId } from 'domain/filters/filter-id';

export abstract class Filter {
  protected plainOptions: string[] = [];
  protected selectedPlainOptions: string[] = [];
  protected selectedMin: string | null = null;
  protected selectedMax: string | null = null;

  constructor(
    private readonly id: FilterId,
    private readonly name: string,
    private readonly cssSelector: string,
    private readonly type: FilterType
  ) {}

  getId(): FilterId {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  getCssSelector(): string {
    return this.cssSelector;
  }

  getType(): FilterType {
    return this.type;
  }

  setPlainOptions(options: string[]): void {
    this.plainOptions = [...options];
  }

  setSelectedPlainOptions(options: string[]): void {
    this.selectedPlainOptions = [...options];
  }

  getSelectedPlainOptions(): string[] {
    return [...this.selectedPlainOptions];
  }

  setMinOptions(_options: string[]): void {}

  setMaxOptions(_options: string[]): void {}

  setSelectedMin(value: string | null): void {
    this.selectedMin = value;
  }

  getSelectedMin(): string | null {
    return this.selectedMin;
  }

  setSelectedMax(value: string | null): void {
    this.selectedMax = value;
  }

  getSelectedMax(): string | null {
    return this.selectedMax;
  }
}
