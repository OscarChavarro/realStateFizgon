import { describe, expect, it, jest } from '@jest/globals';
import { SleepService } from 'adapters/outbound/timing/sleep.service';
import { sleep } from 'infrastructure/sleep';

jest.mock('infrastructure/sleep', () => ({
  sleep: jest.fn(async () => undefined)
}));

describe('SleepService', () => {
  it('whenSleeping_sleep_shouldDelegateToInfrastructureSleep', async () => {
    // Arrange
    const service = new SleepService();
    // Action
    await service.sleep(250);
    // Assert
    expect(sleep).toHaveBeenCalledWith(250);
  });
});
