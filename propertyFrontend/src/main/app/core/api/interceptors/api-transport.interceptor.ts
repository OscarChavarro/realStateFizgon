import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, retry, throwError, timer } from 'rxjs';
import { ApiRuntimeConfigService } from 'src/app/core/api/services/api-runtime-config.service';
import { ApiSessionEventsService } from 'src/app/core/api/services/api-session-events.service';

const TRANSIENT_HTTP_STATUS_CODES = new Set<number>([0, 408, 429, 500, 502, 503, 504]);
const RETRIABLE_METHODS = new Set<string>(['GET', 'HEAD', 'OPTIONS']);
const DEFAULT_RETRY_ATTEMPTS = 2;
const BASE_RETRY_DELAY_MS = 300;
const MAX_RETRY_DELAY_MS = 1500;

export const apiTransportInterceptor: HttpInterceptorFn = (request, next) => {
  const apiRuntimeConfigService = inject(ApiRuntimeConfigService);
  const apiSessionEventsService = inject(ApiSessionEventsService);

  const backendRequest = apiRuntimeConfigService.shouldRouteToBackend(request.url);
  const routedRequest = backendRequest
    ? buildBackendRequest(request, apiRuntimeConfigService)
    : request;

  return next(routedRequest).pipe(
    retry({
      count: DEFAULT_RETRY_ATTEMPTS,
      delay: (error, retryCount) => {
        if (!shouldRetryRequest(routedRequest, error)) {
          throw error;
        }

        const delayMs = Math.min(BASE_RETRY_DELAY_MS * 2 ** (retryCount - 1), MAX_RETRY_DELAY_MS);
        return timer(delayMs);
      }
    }),
    catchError((error: unknown) => {
      if (backendRequest && error instanceof HttpErrorResponse && error.status === 401) {
        apiSessionEventsService.notifyUnauthorized();
      }

      return throwError(() => error);
    })
  );
};

function buildBackendRequest(
  request: HttpRequest<unknown>,
  apiRuntimeConfigService: ApiRuntimeConfigService
): HttpRequest<unknown> {
  const headers = request.headers
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('X-Client-Timezone', Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');

  return request.clone({
    url: apiRuntimeConfigService.resolveBackendUrl(request.url),
    withCredentials: true,
    headers
  });
}

function shouldRetryRequest(request: HttpRequest<unknown>, error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse)) {
    return false;
  }

  if (!RETRIABLE_METHODS.has(request.method.toUpperCase())) {
    return false;
  }

  return TRANSIENT_HTTP_STATUS_CODES.has(error.status);
}
