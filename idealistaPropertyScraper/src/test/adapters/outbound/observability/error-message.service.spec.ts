import { describe, expect, it } from '@jest/globals';
import { ErrorMessageService } from 'adapters/outbound/observability/error-message.service';

describe('ErrorMessageService', () => {
  it('whenErrorIsInstanceOfError_toErrorMessage_shouldReturnErrorMessage', () => {
    // Arrange
    const service = new ErrorMessageService();
    // Action
    const result = service.toErrorMessage(new Error('boom'));
    // Assert
    expect(result).toBe('boom');
  });

  it('whenErrorIsNotError_toErrorMessage_shouldReturnStringifiedValue', () => {
    // Arrange
    const service = new ErrorMessageService();
    // Action
    const result = service.toErrorMessage({ code: 503 });
    // Assert
    expect(result).toBe('[object Object]');
  });
});
