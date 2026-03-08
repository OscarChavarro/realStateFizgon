import { describe, expect, it, jest } from '@jest/globals';
import { CdpClient } from 'src/application/services/scraper/filters/cdp-client.type';
import { FilterSelectedOptionExtractor } from 'src/application/services/scraper/filters/filter-selected-option-extractor.service';

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

describe('FilterSelectedOptionExtractor', () => {
  it.each([
    {
      operation: async (service: FilterSelectedOptionExtractor, client: CdpClient) => service.extractSelectedSingleSelectorDropdownOptions(client, '#a')
    },
    {
      operation: async (service: FilterSelectedOptionExtractor, client: CdpClient) => service.extractSelectedMultipleSelectorOptions(client, '#a')
    },
    {
      operation: async (service: FilterSelectedOptionExtractor, client: CdpClient) => service.extractSelectedSingleSelectorOptions(client, '#a')
    }
  ])('whenRuntimeReturnsStringArray_$operation_shouldReturnArray', async ({ operation }) => {
    // Arrange
    const service = new FilterSelectedOptionExtractor();
    const client = createClient();
    const evaluateMock = client.Runtime.evaluate as unknown as { mockResolvedValue: (value: unknown) => void };
    evaluateMock.mockResolvedValue({ result: { value: ['A'] } });
    // Action
    const result = await operation(service, client);
    // Assert
    expect(result).toEqual(['A']);
  });

  it('whenMinMaxValueContainsInvalidTypes_extractSelectedMinMax_shouldNormalizeToNullableStrings', async () => {
    // Arrange
    const service = new FilterSelectedOptionExtractor();
    const client = createClient();
    const evaluateMock = client.Runtime.evaluate as unknown as { mockResolvedValue: (value: unknown) => void };
    evaluateMock.mockResolvedValue({
      result: { value: { selectedMin: 10, selectedMax: '500' } }
    });
    // Action
    const result = await service.extractSelectedMinMax(client, '#price');
    // Assert
    expect(result).toEqual({ selectedMin: null, selectedMax: '500' });
  });

  it('whenRuntimeThrowsException_extractSelectedSingleSelectorDropdownOptions_shouldThrowError', async () => {
    // Arrange
    const service = new FilterSelectedOptionExtractor();
    const client = createClient();
    const evaluateMock = client.Runtime.evaluate as unknown as { mockResolvedValue: (value: unknown) => void };
    evaluateMock.mockResolvedValue({ exceptionDetails: { text: 'boom' } });
    // Action
    const action = service.extractSelectedSingleSelectorDropdownOptions(client, '#a');
    // Assert
    await expect(action).rejects.toThrow('boom');
  });

  it('whenSelectedMinMaxValueIsMissing_extractSelectedMinMax_shouldReturnNullSelections', async () => {
    // Arrange
    const service = new FilterSelectedOptionExtractor();
    const client = createClient();
    const evaluateMock = client.Runtime.evaluate as unknown as { mockResolvedValue: (value: unknown) => void };
    evaluateMock.mockResolvedValue({ result: { value: undefined } });
    // Action
    const result = await service.extractSelectedMinMax(client, '#price');
    // Assert
    expect(result).toEqual({ selectedMin: null, selectedMax: null });
  });

  it('whenMinMaxEvaluationReturnsException_extractSelectedMinMax_shouldThrowError', async () => {
    // Arrange
    const service = new FilterSelectedOptionExtractor();
    const client = createClient();
    const evaluateMock = client.Runtime.evaluate as unknown as { mockResolvedValue: (value: unknown) => void };
    evaluateMock.mockResolvedValue({ exceptionDetails: { text: 'boom' } });
    // Action
    const action = service.extractSelectedMinMax(client, '#price');
    // Assert
    await expect(action).rejects.toThrow('boom');
  });

  it('whenRuntimeReturnsNonArray_extractSelectedSingleSelectorOptions_shouldReturnEmptyArray', async () => {
    // Arrange
    const service = new FilterSelectedOptionExtractor();
    const client = createClient();
    const evaluateMock = client.Runtime.evaluate as unknown as { mockResolvedValue: (value: unknown) => void };
    evaluateMock.mockResolvedValue({ result: { value: { invalid: true } } });
    // Action
    const result = await service.extractSelectedSingleSelectorOptions(client, '#a');
    // Assert
    expect(result).toEqual([]);
  });
});
