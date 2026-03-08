import { describe, expect, it } from '@jest/globals';
import { OriginErrorDetectorService } from 'src/application/services/resilience/origin-error-detector.service';
import { RuntimeWithEvaluateMock } from '../../../support/mocks/runtime-with-evaluate.mock';

describe('OriginErrorDetectorService', () => {
  it('whenNeedlesAreConfigured_buildConditionExpression_shouldContainAllChecks', () => {
    // Arrange
    const service = new OriginErrorDetectorService();
    // Action
    const result = service.buildConditionExpression('title', 'text');
    // Assert
    expect(result).toContain('title.includes("425 unknown error")');
    expect(result).toContain('title.includes("unknown error")');
    expect(result).toContain('text.includes("error 425 unknown error")');
    expect(result).toContain('text.includes("error 54113")');
    expect(result).toContain('text.includes("varnish cache server")');
  });

  it('whenExpressionIsBuilt_buildIifeExpression_shouldNormalizeTitleAndBodyText', () => {
    // Arrange
    const service = new OriginErrorDetectorService();
    // Action
    const result = service.buildIifeExpression();
    // Assert
    expect(result).toContain(`const title = (document.title || '').toLowerCase();`);
    expect(result).toContain(`const text = (document.body?.innerText || '').toLowerCase();`);
    expect(result).toContain('return title.includes');
  });

  it.each([
    { value: true, expected: true },
    { value: false, expected: false },
    { value: undefined, expected: false }
  ])('whenRuntimeReturnsFlag_hasOriginError_shouldReturnExpectedResult', async ({ value, expected }) => {
    // Arrange
    const service = new OriginErrorDetectorService();
    const runtime = new RuntimeWithEvaluateMock();
    runtime.evaluate.mockResolvedValue({ result: { value } });
    // Action
    const result = await service.hasOriginError(runtime);
    // Assert
    expect(result).toBe(expected);
    expect(runtime.evaluate).toHaveBeenCalledWith({
      expression: service.buildIifeExpression(),
      returnByValue: true
    });
  });
});
