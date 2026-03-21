import { describe, expect, it } from '@jest/globals';
import { PropertyId } from 'domain/property/property-id';

describe('PropertyId', () => {
  it('whenRawValueIsValid_create_shouldTrimAndReturnValueObject', () => {
    // Action
    const propertyId = PropertyId.create(' 123 ');
    // Assert
    expect(propertyId.value).toBe('123');
  });

  it('whenRawValueIsNotString_create_shouldThrowError', () => {
    // Action
    const action = (): PropertyId => PropertyId.create(123 as unknown as string);
    // Assert
    expect(action).toThrow('must be a string');
  });

  it('whenRawValueIsBlank_create_shouldThrowError', () => {
    // Action
    const action = (): PropertyId => PropertyId.create('   ');
    // Assert
    expect(action).toThrow('cannot be empty');
  });

  it('whenTryCreateReceivesNull_tryCreate_shouldReturnNull', () => {
    // Action
    const propertyId = PropertyId.tryCreate(null);
    // Assert
    expect(propertyId).toBeNull();
  });

  it('whenTryCreateReceivesValidValue_tryCreate_shouldReturnValueObject', () => {
    // Action
    const propertyId = PropertyId.tryCreate('456');
    // Assert
    expect(propertyId?.value).toBe('456');
  });

  it('whenTryCreateReceivesInvalidValue_tryCreate_shouldReturnNull', () => {
    // Action
    const propertyId = PropertyId.tryCreate('ABC');
    // Assert
    expect(propertyId).toBeNull();
  });

  it('whenIdsAreCompared_equalsAndToString_shouldUseUnderlyingValue', () => {
    // Arrange
    const left = PropertyId.create('123');
    const right = PropertyId.create('123');
    const other = PropertyId.create('124');
    // Assert
    expect(left.equals(right)).toBe(true);
    expect(left.equals(other)).toBe(false);
    expect(left.toString()).toBe('123');
  });
});
