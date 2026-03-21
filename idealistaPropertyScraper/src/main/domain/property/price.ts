export class Price {
  private constructor(
    public readonly value: number
  ) {}

  static create(rawValue: number): Price {
    if (!Number.isInteger(rawValue)) {
      throw new Error(`Price must be an integer: "${rawValue}".`);
    }

    if (rawValue < 0) {
      throw new Error(`Price must be greater than or equal to zero: "${rawValue}".`);
    }

    return new Price(rawValue);
  }

  static createOptional(rawValue: number | null | undefined): Price | null {
    if (rawValue === null || rawValue === undefined) {
      return null;
    }

    return this.create(rawValue);
  }

  static tryCreate(rawValue: number | null | undefined): Price | null {
    if (rawValue === null || rawValue === undefined) {
      return null;
    }

    try {
      return this.create(rawValue);
    } catch {
      return null;
    }
  }

  equals(other: Price): boolean {
    return this.value === other.value;
  }

  toNumber(): number {
    return this.value;
  }
}
