import { describe, expect, it, jest } from '@jest/globals';
import { sleep } from 'infrastructure/sleep';

describe('sleep', () => {
  it.each([0, 25])('whenDelayIsProvided_sleep_shouldResolveAfterRequestedMilliseconds', async (ms) => {
    // Arrange
    jest.useFakeTimers();
    let resolved = false;
    const promise = sleep(ms).then(() => {
      resolved = true;
    });
    // Action
    await jest.advanceTimersByTimeAsync(ms);
    // Assert
    expect(resolved).toBe(true);
    await promise;
    jest.useRealTimers();
  });
});
