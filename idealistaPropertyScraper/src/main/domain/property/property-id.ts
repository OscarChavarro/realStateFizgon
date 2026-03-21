export class PropertyId {
  private static readonly DIGITS_ONLY_REGEX = /^\d+$/;

  private constructor(
    public readonly value: string
  ) {}

  static create(rawValue: string): PropertyId {
    if (typeof rawValue !== 'string') {
      throw new Error('PropertyId must be a string.');
    }

    const normalizedValue = rawValue.trim();
    if (!normalizedValue) {
      throw new Error('PropertyId cannot be empty.');
    }

    if (!this.DIGITS_ONLY_REGEX.test(normalizedValue)) {
      throw new Error(`PropertyId must contain only digits: "${rawValue}".`);
    }

    return new PropertyId(normalizedValue);
  }

  static tryCreate(rawValue: string | null | undefined): PropertyId | null {
    if (rawValue === null || rawValue === undefined) {
      return null;
    }

    try {
      return this.create(rawValue);
    } catch {
      return null;
    }
  }

  equals(other: PropertyId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
