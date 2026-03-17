import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
  RequestErrorCategory,
  RequestErrorClassification
} from 'src/app/core/errors/model/request-error-classification.type';

type RetryableOperationOptions<T> = {
  operation: string;
  maxAttempts?: number;
  retryDelayMs?: number;
  request: () => Promise<T>;
  notifyOnRetry?: boolean;
  notifyOnFailure?: boolean;
};

type RetryableValueOperationOptions<T> = {
  operation: string;
  maxAttempts?: number;
  retryDelayMs?: number;
  request: () => Promise<T>;
  fallback: () => T | Promise<T>;
  notifyOnRetry?: boolean;
  notifyOnFailure?: boolean;
  shouldNotifyOnFailure?: (classification: RequestErrorClassification) => boolean;
};

const TRANSIENT_HTTP_STATUS_CODES = new Set<number>([0, 408, 425, 429, 500, 502, 503, 504]);
const DEFAULT_MAX_ATTEMPTS = 2;
const DEFAULT_RETRY_DELAY_MS = 250;

@Injectable({
  providedIn: 'root'
})
export class RequestErrorPolicyService {
  classify(error: unknown): RequestErrorClassification {
    if (error instanceof HttpErrorResponse) {
      const status = Number.isFinite(error.status) ? error.status : null;
      const message = this.toErrorMessage(error);
      if (status !== null && TRANSIENT_HTTP_STATUS_CODES.has(status)) {
        return { category: 'transient', status, message };
      }
      if (status === 401) {
        return { category: 'unauthorized', status, message };
      }
      if (status === 403) {
        return { category: 'forbidden', status, message };
      }
      if (status === 404) {
        return { category: 'not-found', status, message };
      }
      if (status !== null && status >= 400 && status < 500) {
        return { category: 'validation', status, message };
      }
      if (status !== null && status >= 500) {
        return { category: 'server', status, message };
      }

      return { category: 'unknown', status, message };
    }

    return {
      category: 'unknown',
      status: null,
      message: this.toErrorMessage(error)
    };
  }

  async executeWithFallback<T>(options: RetryableValueOperationOptions<T>): Promise<T> {
    const maxAttempts = this.normalizeAttempts(options.maxAttempts);
    const retryDelayMs = this.normalizeRetryDelay(options.retryDelayMs);
    const notifyOnRetry = options.notifyOnRetry ?? true;
    const notifyOnFailure = options.notifyOnFailure ?? true;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await options.request();
      } catch (error) {
        const classification = this.classify(error);
        const canRetry = attempt < maxAttempts && this.isRetryable(classification.category);

        if (canRetry) {
          if (notifyOnRetry) {
            this.notifyRetry(options.operation, attempt, maxAttempts, retryDelayMs, classification);
          }
          await this.sleep(retryDelayMs * attempt);
          continue;
        }

        const shouldNotify = options.shouldNotifyOnFailure?.(classification) ?? notifyOnFailure;
        if (shouldNotify) {
          this.notifyFallback(options.operation, classification);
        }
        return options.fallback();
      }
    }

    return options.fallback();
  }

  async executeOrThrow<T>(options: RetryableOperationOptions<T>): Promise<T> {
    const maxAttempts = this.normalizeAttempts(options.maxAttempts);
    const retryDelayMs = this.normalizeRetryDelay(options.retryDelayMs);
    const notifyOnRetry = options.notifyOnRetry ?? true;
    const notifyOnFailure = options.notifyOnFailure ?? true;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await options.request();
      } catch (error) {
        const classification = this.classify(error);
        const canRetry = attempt < maxAttempts && this.isRetryable(classification.category);

        if (canRetry) {
          if (notifyOnRetry) {
            this.notifyRetry(options.operation, attempt, maxAttempts, retryDelayMs, classification);
          }
          await this.sleep(retryDelayMs * attempt);
          continue;
        }

        if (notifyOnFailure) {
          this.notifyFailure(options.operation, classification);
        }
        throw error;
      }
    }

    throw new Error(`[RequestErrorPolicy] ${options.operation} exhausted retry attempts.`);
  }

  notifyFailure(operation: string, classification: RequestErrorClassification): void {
    console.error(
      `[RequestErrorPolicy] ${operation} failed permanently (${classification.category}${classification.status !== null ? `:${classification.status}` : ''}). ${classification.message}`
    );
  }

  notifyFallback(operation: string, classification: RequestErrorClassification): void {
    console.warn(
      `[RequestErrorPolicy] ${operation} failed and fallback was applied (${classification.category}${classification.status !== null ? `:${classification.status}` : ''}). ${classification.message}`
    );
  }

  notifyRecovery(operation: string, reason: string, error: unknown): void {
    const classification = this.classify(error);
    console.warn(
      `[RequestErrorPolicy] ${operation} applying recovery strategy "${reason}" after ${classification.category}${classification.status !== null ? `:${classification.status}` : ''}. ${classification.message}`
    );
  }

  private normalizeAttempts(value: number | undefined): number {
    if (value === undefined || !Number.isFinite(value) || value < 1) {
      return DEFAULT_MAX_ATTEMPTS;
    }

    return Math.floor(value);
  }

  private normalizeRetryDelay(value: number | undefined): number {
    if (value === undefined || !Number.isFinite(value) || value < 0) {
      return DEFAULT_RETRY_DELAY_MS;
    }

    return Math.floor(value);
  }

  private isRetryable(category: RequestErrorCategory): boolean {
    return category === 'transient' || category === 'server';
  }

  private notifyRetry(
    operation: string,
    attempt: number,
    maxAttempts: number,
    retryDelayMs: number,
    classification: RequestErrorClassification
  ): void {
    console.warn(
      `[RequestErrorPolicy] ${operation} attempt ${attempt}/${maxAttempts} failed (${classification.category}${classification.status !== null ? `:${classification.status}` : ''}). Retrying in ${retryDelayMs * attempt}ms. ${classification.message}`
    );
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (typeof error.error === 'string' && error.error.trim().length > 0) {
        return error.error.trim();
      }

      if (typeof error.error === 'object' && error.error !== null) {
        const messageValue =
          (error.error as { message?: unknown; error?: unknown }).message ??
          (error.error as { message?: unknown; error?: unknown }).error;
        if (typeof messageValue === 'string' && messageValue.trim().length > 0) {
          return messageValue.trim();
        }
      }

      if (typeof error.message === 'string' && error.message.trim().length > 0) {
        return error.message.trim();
      }

      return 'HTTP request failed.';
    }

    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message.trim();
    }

    if (typeof error === 'string' && error.trim().length > 0) {
      return error.trim();
    }

    return 'Unexpected request failure.';
  }

  private async sleep(delayMs: number): Promise<void> {
    await new Promise((resolve) => {
      setTimeout(resolve, delayMs);
    });
  }
}
