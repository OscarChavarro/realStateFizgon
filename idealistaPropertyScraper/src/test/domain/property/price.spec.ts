import { describe, expect, it } from '@jest/globals';
import { Price } from 'domain/property/price';

describe('Price', () => {
  it('whenRawValueIsValid_create_shouldReturnValueObject', () => {
    // Action
    const price = Price.create(1200);
    // Assert
    expect(price.value).toBe(1200);
  });

  it('whenRawValueIsDecimal_create_shouldThrowError', () => {
    // Action
    const action = (): Price => Price.create(1200.5);
    // Assert
    expect(action).toThrow('must be an integer');
  });

  it('whenRawValueIsNegative_create_shouldThrowError', () => {
    // Action
    const action = (): Price => Price.create(-1);
    // Assert
    expect(action).toThrow('greater than or equal to zero');
  });

  it('whenOptionalValueIsNull_createOptional_shouldReturnNull', () => {
    // Action
    const price = Price.createOptional(null);
    // Assert
    expect(price).toBeNull();
  });

  it('whenTryCreateReceivesNull_tryCreate_shouldReturnNull', () => {
    // Action
    const price = Price.tryCreate(null);
    // Assert
    expect(price).toBeNull();
  });

  it('whenTryCreateReceivesValidValue_tryCreate_shouldReturnValueObject', () => {
    // Action
    const price = Price.tryCreate(500);
    // Assert
    expect(price?.value).toBe(500);
  });

  it('whenTryCreateReceivesInvalidValue_tryCreate_shouldReturnNull', () => {
    // Action
    const price = Price.tryCreate(500.2);
    // Assert
    expect(price).toBeNull();
  });

  it('whenPricesAreCompared_equalsAndToNumber_shouldUseUnderlyingValue', () => {
    // Arrange
    const left = Price.create(1000);
    const right = Price.create(1000);
    const other = Price.create(1100);
    // Assert
    expect(left.equals(right)).toBe(true);
    expect(left.equals(other)).toBe(false);
    expect(left.toNumber()).toBe(1000);
  });
});
