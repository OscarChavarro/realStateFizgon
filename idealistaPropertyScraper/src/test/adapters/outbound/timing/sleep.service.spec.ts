import { describe, expect, it, jest } from '@jest/globals';
import { SleepService } from 'src/adapters/outbound/timing/sleep.service';
import { sleep } from 'src/infrastructure/sleep';

jest.mock('src/infrastructure/sleep', () => ({
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
