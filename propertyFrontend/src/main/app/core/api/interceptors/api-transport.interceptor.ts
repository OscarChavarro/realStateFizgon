import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ApiRuntimeConfigService } from 'src/app/core/api/services/api-runtime-config.service';
import { ApiSessionEventsService } from 'src/app/core/api/services/api-session-events.service';

export const apiTransportInterceptor: HttpInterceptorFn = (request, next) => {
  const apiRuntimeConfigService = inject(ApiRuntimeConfigService);
  const apiSessionEventsService = inject(ApiSessionEventsService);

  const backendRequest = apiRuntimeConfigService.shouldRouteToBackend(request.url);
  const routedRequest = backendRequest
    ? buildBackendRequest(request, apiRuntimeConfigService)
    : request;

  return next(routedRequest).pipe(
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
