import { describe, expect, it, jest } from '@jest/globals';
import { CdpClient } from 'src/application/services/scraper/filters/cdp-client.type';
import { FilterSelectionReaderService } from 'src/application/services/scraper/filters/filter-selection-reader.service';
import { FilterType } from 'src/domain/filters/filter-type.enum';

type FilterLike = {
  getType(): FilterType;
  getCssSelector(): string;
};

function createFilter(type: FilterType, selector = '#a'): FilterLike {
  return {
    getType: () => type,
    getCssSelector: () => selector
  };
}

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

describe('FilterSelectionReaderService', () => {
  it.each([
    { type: FilterType.SINGLE_SELECTOR_DROPDOWN },
    { type: FilterType.MULTIPLE_SELECTOR },
    { type: FilterType.SINGLE_SELECTOR },
    { type: FilterType.MIN_MAX }
  ])('whenPlainSelectionIsRead_readCurrentPlainSelection_shouldUseTypeSpecificStrategy', async ({ type }) => {
    // Arrange
    const service = new FilterSelectionReaderService();
    const client = createClient();
    const evaluateMock = client.Runtime.evaluate as unknown as { mockResolvedValue: (value: unknown) => void };
    evaluateMock.mockResolvedValue({ result: { value: ['A'] } });
    // Action
    const result = await service.readCurrentPlainSelection(client, createFilter(type) as never);
    // Assert
    if (type === FilterType.MIN_MAX) {
      expect(result).toEqual([]);
    } else {
      expect(result).toEqual(['A']);
    }
  });

  it('whenMinMaxSelectionIsRead_readCurrentMinMaxSelection_shouldReturnFallbackWhenValueIsMissing', async () => {
    // Arrange
    const service = new FilterSelectionReaderService();
    const client = createClient();
    const evaluateMock = client.Runtime.evaluate as unknown as { mockResolvedValue: (value: unknown) => void };
    evaluateMock.mockResolvedValue({ result: { value: undefined } });
    // Action
    const result = await service.readCurrentMinMaxSelection(client, '#price');
    // Assert
    expect(result).toEqual({ selectedMin: null, selectedMax: null });
  });

  it('whenRuntimeThrowsException_readCurrentMinMaxSelection_shouldThrowError', async () => {
    // Arrange
    const service = new FilterSelectionReaderService();
    const client = createClient();
    const evaluateMock = client.Runtime.evaluate as unknown as { mockResolvedValue: (value: unknown) => void };
    evaluateMock.mockResolvedValue({ exceptionDetails: { text: 'boom' } });
    // Action
    const action = service.readCurrentMinMaxSelection(client, '#price');
    // Assert
    await expect(action).rejects.toThrow('boom');
  });

  it('whenMinMaxSelectionContainsInvalidTypes_readCurrentMinMaxSelection_shouldNormalizeToNullableStrings', async () => {
    // Arrange
    const service = new FilterSelectionReaderService();
    const client = createClient();
    const evaluateMock = client.Runtime.evaluate as unknown as { mockResolvedValue: (value: unknown) => void };
    evaluateMock.mockResolvedValue({
      result: {
        value: {
          selectedMin: 100,
          selectedMax: '500'
        }
      }
    });
    // Action
    const result = await service.readCurrentMinMaxSelection(client, '#price');
    // Assert
    expect(result).toEqual({ selectedMin: null, selectedMax: '500' });
  });

  it('whenPlainSelectionEvaluationReturnsException_readCurrentPlainSelection_shouldThrowError', async () => {
    // Arrange
    const service = new FilterSelectionReaderService();
    const client = createClient();
    const evaluateMock = client.Runtime.evaluate as unknown as { mockResolvedValue: (value: unknown) => void };
    evaluateMock.mockResolvedValue({ exceptionDetails: { text: 'boom' } });
    // Action
    const action = service.readCurrentPlainSelection(client, createFilter(FilterType.SINGLE_SELECTOR_DROPDOWN) as never);
    // Assert
    await expect(action).rejects.toThrow('boom');
  });

  it('whenPlainSelectionEvaluationReturnsNonArray_readCurrentPlainSelection_shouldReturnEmptyArray', async () => {
    // Arrange
    const service = new FilterSelectionReaderService();
    const client = createClient();
    const evaluateMock = client.Runtime.evaluate as unknown as { mockResolvedValue: (value: unknown) => void };
    evaluateMock.mockResolvedValue({ result: { value: { invalid: true } } });
    // Action
    const result = await service.readCurrentPlainSelection(client, createFilter(FilterType.MULTIPLE_SELECTOR) as never);
    // Assert
    expect(result).toEqual([]);
  });
});
