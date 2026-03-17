import { HttpErrorResponse } from '@angular/common/http';
import { RequestErrorPolicyService } from 'src/app/core/errors/services/request-error-policy.service';

describe('RequestErrorPolicyService', () => {
  it('whenClassifyingHttpError_classify_shouldMapCategoryAndMessage', () => {
    // Arrange
    const service = new RequestErrorPolicyService();
    const transientError = new HttpErrorResponse({ status: 503, error: { message: 'service unavailable' } });
    const validationError = new HttpErrorResponse({ status: 400, error: 'bad request' });
    const unauthorizedError = new HttpErrorResponse({ status: 401, error: { error: 'unauthorized' } });

    // Action
    const transient = service.classify(transientError);
    const validation = service.classify(validationError);
    const unauthorized = service.classify(unauthorizedError);

    // Assert
    expect(transient).toEqual({ category: 'transient', status: 503, message: 'service unavailable' });
    expect(validation).toEqual({ category: 'validation', status: 400, message: 'bad request' });
    expect(unauthorized).toEqual({ category: 'unauthorized', status: 401, message: 'unauthorized' });
  });

  it('whenTransientErrorThenSuccess_executeWithFallback_shouldRetryAndReturnResponse', async () => {
    // Arrange
    const service = new RequestErrorPolicyService();
    const warnSpy = spyOn(console, 'warn');
    let attempts = 0;

    // Action
    const result = await service.executeWithFallback({
      operation: 'test.operation',
      retryDelayMs: 0,
      request: async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new HttpErrorResponse({ status: 503, error: 'temporarily unavailable' });
        }
        return 'ok';
      },
      fallback: () => 'fallback'
    });

    // Assert
    expect(result).toBe('ok');
    expect(attempts).toBe(2);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('whenUnknownError_executeWithFallback_shouldNotRetryAndUseFallback', async () => {
    // Arrange
    const service = new RequestErrorPolicyService();
    const warnSpy = spyOn(console, 'warn');
    let attempts = 0;

    // Action
    const result = await service.executeWithFallback({
      operation: 'test.fallback',
      retryDelayMs: 0,
      request: async () => {
        attempts += 1;
        throw new Error('boom');
      },
      fallback: () => 'fallback'
    });

    // Assert
    expect(result).toBe('fallback');
    expect(attempts).toBe(1);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('whenRequestKeepsFailing_executeOrThrow_shouldRetryThenThrow', async () => {
    // Arrange
    const service = new RequestErrorPolicyService();
    const warnSpy = spyOn(console, 'warn');
    const errorSpy = spyOn(console, 'error');
    let attempts = 0;

    // Action
    const action = service.executeOrThrow({
      operation: 'test.throw',
      retryDelayMs: 0,
      request: async () => {
        attempts += 1;
        throw new HttpErrorResponse({ status: 503, error: 'down' });
      }
    });

    // Assert
    await expectAsync(action).toBeRejected();
    expect(attempts).toBe(2);
    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('whenHttpStatusesCoverEdgeCases_classify_shouldMapForbiddenNotFoundServerAndUnknown', () => {
    // Arrange
    const service = new RequestErrorPolicyService();
    const forbiddenError = new HttpErrorResponse({ status: 403, error: { message: 'forbidden' } });
    const notFoundError = new HttpErrorResponse({ status: 404, error: { message: 'missing' } });
    const serverError = new HttpErrorResponse({ status: 501, error: { message: 'server' } });
    const unknownHttpError = new HttpErrorResponse({ status: Number.NaN, error: { message: 'unknown-http' } });

    // Action
    const forbidden = service.classify(forbiddenError);
    const notFound = service.classify(notFoundError);
    const server = service.classify(serverError);
    const unknown = service.classify(unknownHttpError);

    // Assert
    expect(forbidden).toEqual({ category: 'forbidden', status: 403, message: 'forbidden' });
    expect(notFound).toEqual({ category: 'not-found', status: 404, message: 'missing' });
    expect(server).toEqual({ category: 'server', status: 501, message: 'server' });
    expect(unknown).toEqual({ category: 'unknown', status: null, message: 'unknown-http' });
  });

  it('whenHttpErrorUsesMessageFallback_classify_shouldUseHttpMessageOrDefaultMessage', () => {
    // Arrange
    const service = new RequestErrorPolicyService();
    const messageFallbackError = new HttpErrorResponse({ status: 418, error: {} });
    const defaultFallbackError = new HttpErrorResponse({ status: 418, error: {} });
    Object.defineProperty(messageFallbackError, 'message', { configurable: true, value: '  from-http-message  ' });
    Object.defineProperty(defaultFallbackError, 'message', { configurable: true, value: '   ' });

    // Action
    const messageFallback = service.classify(messageFallbackError);
    const defaultFallback = service.classify(defaultFallbackError);

    // Assert
    expect(messageFallback).toEqual({ category: 'validation', status: 418, message: 'from-http-message' });
    expect(defaultFallback).toEqual({ category: 'validation', status: 418, message: 'HTTP request failed.' });
  });

  it('whenErrorIsStringOrUnknownObject_classify_shouldReturnNormalizedUnknownMessages', () => {
    // Arrange
    const service = new RequestErrorPolicyService();

    // Action
    const fromString = service.classify('  custom error text  ');
    const fromUnknownObject = service.classify({ value: 'x' });

    // Assert
    expect(fromString).toEqual({ category: 'unknown', status: null, message: 'custom error text' });
    expect(fromUnknownObject).toEqual({ category: 'unknown', status: null, message: 'Unexpected request failure.' });
  });

  it('whenAttemptsAreForcedToZero_executeWithFallback_shouldReturnFallbackAfterLoop', async () => {
    // Arrange
    const service = new RequestErrorPolicyService();
    const normalizeAttemptsSpy = spyOn<any>(service, 'normalizeAttempts').and.returnValue(0);
    const requestSpy = jasmine.createSpy('request').and.resolveTo('ok');
    const fallbackSpy = jasmine.createSpy('fallback').and.returnValue('fallback');

    // Action
    const result = await service.executeWithFallback({
      operation: 'test.zero-attempts-fallback',
      request: requestSpy,
      fallback: fallbackSpy
    });

    // Assert
    expect(normalizeAttemptsSpy).toHaveBeenCalled();
    expect(requestSpy).not.toHaveBeenCalled();
    expect(fallbackSpy).toHaveBeenCalledTimes(1);
    expect(result).toBe('fallback');
  });

  it('whenAttemptsAreForcedToZero_executeOrThrow_shouldThrowExhaustedAttemptsError', async () => {
    // Arrange
    const service = new RequestErrorPolicyService();
    const normalizeAttemptsSpy = spyOn<any>(service, 'normalizeAttempts').and.returnValue(0);
    const requestSpy = jasmine.createSpy('request').and.resolveTo('ok');

    // Action
    const action = service.executeOrThrow({
      operation: 'test.zero-attempts-throw',
      request: requestSpy
    });

    // Assert
    await expectAsync(action).toBeRejectedWithError(
      '[RequestErrorPolicy] test.zero-attempts-throw exhausted retry attempts.'
    );
    expect(normalizeAttemptsSpy).toHaveBeenCalled();
    expect(requestSpy).not.toHaveBeenCalled();
  });

  it('whenNotifyingWithAndWithoutStatus_notifyMethods_shouldRenderBothMessageShapes', () => {
    // Arrange
    const service = new RequestErrorPolicyService();
    const warnSpy = spyOn(console, 'warn');
    const errorSpy = spyOn(console, 'error');

    // Action
    service.notifyFailure('test.notifyFailure', { category: 'unknown', status: null, message: 'unknown' });
    service.notifyFallback('test.notifyFallback', { category: 'transient', status: 503, message: 'down' });
    service.notifyRecovery('test.notifyRecovery', 'fallback', new Error('recovery'));
    (service as any).notifyRetry('test.notifyRetry', 1, 2, 10, {
      category: 'unknown',
      status: null,
      message: 'retrying'
    });

    // Assert
    expect(errorSpy).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    const warnMessages = warnSpy.calls.allArgs().map((args) => String(args[0]));
    expect(warnMessages.some((message) => message.includes('test.notifyRecovery'))).toBeTrue();
    expect(warnMessages.some((message) => message.includes('test.notifyFallback') && message.includes(':503'))).toBeTrue();
    expect(warnMessages.some((message) => message.includes('test.notifyRetry') && !message.includes(':null'))).toBeTrue();
  });

  it('whenNotifyRecoveryReceivesHttpError_notifyRecovery_shouldIncludeStatusSuffix', () => {
    // Arrange
    const service = new RequestErrorPolicyService();
    const warnSpy = spyOn(console, 'warn');
    const error = new HttpErrorResponse({ status: 503, error: { message: 'temporarily unavailable' } });

    // Action
    service.notifyRecovery('test.notifyRecoveryWithStatus', 'retry', error);

    // Assert
    expect(warnSpy).toHaveBeenCalled();
    expect(String(warnSpy.calls.mostRecent().args[0])).toContain(':503');
  });

  it('whenMaxAttemptsIsFraction_executeWithFallback_shouldFloorAttemptsAndUseCustomRetries', async () => {
    // Arrange
    const service = new RequestErrorPolicyService();
    let attempts = 0;

    // Action
    const result = await service.executeWithFallback({
      operation: 'test.fraction-attempts',
      maxAttempts: 2.8,
      retryDelayMs: 0,
      request: async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new HttpErrorResponse({ status: 503, error: { message: 'temporary' } });
        }
        return 'ok';
      },
      fallback: () => 'fallback'
    });

    // Assert
    expect(result).toBe('ok');
    expect(attempts).toBe(2);
  });

  it('whenMaxAttemptsIsNanOrLessThanOne_executeWithFallback_shouldUseDefaultAttemptCount', async () => {
    // Arrange
    const service = new RequestErrorPolicyService();
    let nanAttempts = 0;
    let lowAttempts = 0;

    // Action
    const nanResult = await service.executeWithFallback({
      operation: 'test.nan-attempts',
      maxAttempts: Number.NaN,
      retryDelayMs: 0,
      request: async () => {
        nanAttempts += 1;
        if (nanAttempts === 1) {
          throw new HttpErrorResponse({ status: 503, error: { message: 'temporary' } });
        }
        return 'ok-nan';
      },
      fallback: () => 'fallback-nan'
    });
    const lowResult = await service.executeWithFallback({
      operation: 'test.low-attempts',
      maxAttempts: 0.5,
      retryDelayMs: 0,
      request: async () => {
        lowAttempts += 1;
        if (lowAttempts === 1) {
          throw new HttpErrorResponse({ status: 503, error: { message: 'temporary' } });
        }
        return 'ok-low';
      },
      fallback: () => 'fallback-low'
    });

    // Assert
    expect(nanResult).toBe('ok-nan');
    expect(lowResult).toBe('ok-low');
    expect(nanAttempts).toBe(2);
    expect(lowAttempts).toBe(2);
  });
});
