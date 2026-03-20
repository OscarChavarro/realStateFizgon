import { describe, expect, it } from '@jest/globals';
import { SecretsGeolocationSchema } from 'infrastructure/config/validation/chrome.schema';

describe('SecretsGeolocationSchema', () => {
  it.each([
    {
      payload: {
        latitude: 40.4167
      }
    },
    {
      payload: {
        longitude: -3.7033
      }
    }
  ])('whenOneCoordinateIsMissing_safeParse_shouldFailValidation', ({ payload }) => {
    // Arrange
    const schema = SecretsGeolocationSchema;
    // Action
    const result = schema.safeParse(payload);
    // Assert
    expect(result.success).toBe(false);
  });

  it('whenBothCoordinatesAreProvided_safeParse_shouldSucceed', () => {
    // Arrange
    const schema = SecretsGeolocationSchema;
    // Action
    const result = schema.safeParse({
      latitude: 40.4167,
      longitude: -3.7033,
      accuracy: 25
    });
    // Assert
    expect(result.success).toBe(true);
  });
});
