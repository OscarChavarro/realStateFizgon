import { describe, expect, it, jest } from '@jest/globals';
import { CdpClient } from 'src/application/services/scraper/filters/cdp-client.type';
import { FilterAvailableOptionExtractor } from 'src/application/services/scraper/filters/filter-available-option-extractor.service';

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

describe('FilterAvailableOptionExtractor', () => {
  it.each([
    {
      operation: async (service: FilterAvailableOptionExtractor, client: CdpClient) => service.extractSingleSelectorDropdownOptions(client, '#a')
    },
    {
      operation: async (service: FilterAvailableOptionExtractor, client: CdpClient) => service.extractMultipleSelectorOptions(client, '#a')
    },
    {
      operation: async (service: FilterAvailableOptionExtractor, client: CdpClient) => service.extractSingleSelectorOptions(client, '#a')
    }
  ])('whenRuntimeReturnsStringArray_$operation_shouldReturnArray', async ({ operation }) => {
    // Arrange
    const service = new FilterAvailableOptionExtractor();
    const client = createClient();
    const evaluateMock = client.Runtime.evaluate as unknown as { mockResolvedValue: (value: unknown) => void };
    evaluateMock.mockResolvedValue({ result: { value: ['A', 'B'] } });
    // Action
    const result = await operation(service, client);
    // Assert
    expect(result).toEqual(['A', 'B']);
  });

  it('whenMinMaxValueIsMissing_extractMinMaxOptions_shouldReturnDefaultEmptySelections', async () => {
    // Arrange
    const service = new FilterAvailableOptionExtractor();
    const client = createClient();
    const evaluateMock = client.Runtime.evaluate as unknown as { mockResolvedValue: (value: unknown) => void };
    evaluateMock.mockResolvedValue({ result: { value: undefined } });
    // Action
    const result = await service.extractMinMaxOptions(client, '#price');
    // Assert
    expect(result).toEqual({ minOptions: [], maxOptions: [] });
  });

  it('whenRuntimeThrowsException_extractMinMaxOptions_shouldThrowError', async () => {
    // Arrange
    const service = new FilterAvailableOptionExtractor();
    const client = createClient();
    const evaluateMock = client.Runtime.evaluate as unknown as { mockResolvedValue: (value: unknown) => void };
    evaluateMock.mockResolvedValue({ exceptionDetails: { text: 'boom' } });
    // Action
    const action = service.extractMinMaxOptions(client, '#price');
    // Assert
    await expect(action).rejects.toThrow('boom');
  });

  it('whenMinMaxContainsMixedTypes_extractMinMaxOptions_shouldKeepOnlyStringOptions', async () => {
    // Arrange
    const service = new FilterAvailableOptionExtractor();
    const client = createClient();
    const evaluateMock = client.Runtime.evaluate as unknown as { mockResolvedValue: (value: unknown) => void };
    evaluateMock.mockResolvedValue({
      result: {
        value: {
          minOptions: ['100', 200, null],
          maxOptions: ['900', false, '1200']
        }
      }
    });
    // Action
    const result = await service.extractMinMaxOptions(client, '#price');
    // Assert
    expect(result).toEqual({ minOptions: ['100'], maxOptions: ['900', '1200'] });
  });

  it('whenMinMaxContainsNonArrayValues_extractMinMaxOptions_shouldFallbackToEmptyArrays', async () => {
    // Arrange
    const service = new FilterAvailableOptionExtractor();
    const client = createClient();
    const evaluateMock = client.Runtime.evaluate as unknown as { mockResolvedValue: (value: unknown) => void };
    evaluateMock.mockResolvedValue({
      result: {
        value: {
          minOptions: '100',
          maxOptions: 200
        }
      }
    });
    // Action
    const result = await service.extractMinMaxOptions(client, '#price');
    // Assert
    expect(result).toEqual({ minOptions: [], maxOptions: [] });
  });

  it('whenRuntimeArrayEvaluationFails_extractSingleSelectorOptions_shouldThrowError', async () => {
    // Arrange
    const service = new FilterAvailableOptionExtractor();
    const client = createClient();
    const evaluateMock = client.Runtime.evaluate as unknown as { mockResolvedValue: (value: unknown) => void };
    evaluateMock.mockResolvedValue({ exceptionDetails: { text: 'boom' } });
    // Action
    const action = service.extractSingleSelectorOptions(client, '#price');
    // Assert
    await expect(action).rejects.toThrow('boom');
  });

  it('whenRuntimeReturnsNonArray_extractMultipleSelectorOptions_shouldReturnEmptyArray', async () => {
    // Arrange
    const service = new FilterAvailableOptionExtractor();
    const client = createClient();
    const evaluateMock = client.Runtime.evaluate as unknown as { mockResolvedValue: (value: unknown) => void };
    evaluateMock.mockResolvedValue({ result: { value: { invalid: true } } });
    // Action
    const result = await service.extractMultipleSelectorOptions(client, '#price');
    // Assert
    expect(result).toEqual([]);
  });
});
