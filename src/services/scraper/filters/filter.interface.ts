import { FilterType } from './filter-type.enum';

export abstract class Filter {
  protected plainOptions: string[] = [];

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
}
