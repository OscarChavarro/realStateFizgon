import { FilterType } from './filter-type.enum';

export abstract class Filter {
  protected plainOptions: string[] = [];
  protected selectedPlainOptions: string[] = [];
  protected selectedMin: string | null = null;
  protected selectedMax: string | null = null;

  constructor(
    private readonly name: string,
    private readonly cssSelector: string,
    private readonly type: FilterType
  ) {}

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

  setMinOptions(_options: string[]): void {}

  setMaxOptions(_options: string[]): void {}

  setSelectedMin(value: string | null): void {
    this.selectedMin = value;
  }

  setSelectedMax(value: string | null): void {
    this.selectedMax = value;
  }
}
