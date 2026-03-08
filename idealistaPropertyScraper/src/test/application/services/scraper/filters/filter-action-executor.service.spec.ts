import { describe, expect, it, jest } from '@jest/globals';
import { CdpClient } from 'src/application/services/scraper/filters/cdp-client.type';
import { FilterActionExecutorService } from 'src/application/services/scraper/filters/filter-action-executor.service';

function createClient(): CdpClient {
  const evaluateMock = jest.fn();
  return {
    Runtime: {
      enable: jest.fn(async () => undefined),
      evaluate: evaluateMock as unknown as CdpClient['Runtime']['evaluate']
    },
    Page: {
      reload: jest.fn(async () => undefined),
      loadEventFired: jest.fn()
    }
  };
}

describe('FilterActionExecutorService', () => {
  it.each([
    {
      operation: async (service: FilterActionExecutorService, client: CdpClient) => service.clickPlainOption(client, '#a', 'A', 'enable'),
      value: true,
      expected: true
    },
    {
      operation: async (service: FilterActionExecutorService, client: CdpClient) => service.clickSingleSelectorDropdownOption(client, '#a', 'A'),
      value: false,
      expected: false
    },
    {
      operation: async (service: FilterActionExecutorService, client: CdpClient) => service.clickMinMaxOption(client, '#a', 'min', '100'),
      value: true,
      expected: true
    }
  ])('whenRuntimeReturnsBoolean_$operation_shouldReturnBooleanResult', async ({ operation, value, expected }) => {
    // Arrange
    const service = new FilterActionExecutorService();
    const client = createClient();
    const evaluateMock = client.Runtime.evaluate as unknown as { mockResolvedValue: (value: unknown) => void };
    evaluateMock.mockResolvedValue({ result: { value } });
    // Action
    const result = await operation(service, client);
    // Assert
    expect(result).toBe(expected);
  });

  it.each([
    {
      operation: async (service: FilterActionExecutorService, client: CdpClient) => service.clickPlainOption(client, '#a', 'A', 'enable')
    },
    {
      operation: async (service: FilterActionExecutorService, client: CdpClient) => service.clickSingleSelectorDropdownOption(client, '#a', 'A')
    },
    {
      operation: async (service: FilterActionExecutorService, client: CdpClient) => service.clickMinMaxOption(client, '#a', 'max', '500')
    }
  ])('whenRuntimeReturnsException_$operation_shouldThrowError', async ({ operation }) => {
    // Arrange
    const service = new FilterActionExecutorService();
    const client = createClient();
    const evaluateMock = client.Runtime.evaluate as unknown as { mockResolvedValue: (value: unknown) => void };
    evaluateMock.mockResolvedValue({ exceptionDetails: { text: 'boom' } });
    // Action
    const action = operation(service, client);
    // Assert
    await expect(action).rejects.toThrow('boom');
  });
});
