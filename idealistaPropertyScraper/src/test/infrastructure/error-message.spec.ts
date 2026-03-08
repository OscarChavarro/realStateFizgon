import { describe, expect, it } from '@jest/globals';
import { toErrorMessage } from 'src/infrastructure/error-message';

describe('toErrorMessage', () => {
  it('whenValueIsError_toErrorMessage_shouldReturnMessage', () => {
    // Arrange
    const input = new Error('boom');
    // Action
    const result = toErrorMessage(input);
    // Assert
    expect(result).toBe('boom');
  });

  it.each([
    { value: 'plain', expected: 'plain' },
    { value: 42, expected: '42' },
    { value: null, expected: 'null' },
    { value: undefined, expected: 'undefined' }
  ])('whenValueIsNonError_toErrorMessage_shouldReturnStringValue', ({ value, expected }) => {
    // Arrange
    const input: unknown = value;
    // Action
    const result = toErrorMessage(input);
    // Assert
    expect(result).toBe(expected);
  });
});
