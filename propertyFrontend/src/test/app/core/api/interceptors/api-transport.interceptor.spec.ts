import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpRequest,
  HttpResponse
} from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Observable, defer, of, throwError } from 'rxjs';
import { ApiRuntimeConfigService } from 'src/app/core/api/services/api-runtime-config.service';
import { ApiSessionEventsService } from 'src/app/core/api/services/api-session-events.service';
import { apiTransportInterceptor } from 'src/app/core/api/interceptors/api-transport.interceptor';

describe('apiTransportInterceptor', () => {
  let runtimeConfig: jasmine.SpyObj<ApiRuntimeConfigService>;
  let sessionEvents: jasmine.SpyObj<ApiSessionEventsService>;

  beforeEach(() => {
    runtimeConfig = jasmine.createSpyObj<ApiRuntimeConfigService>('ApiRuntimeConfigService', [
      'shouldRouteToBackend',
      'resolveBackendUrl'
    ]);
    sessionEvents = jasmine.createSpyObj<ApiSessionEventsService>('ApiSessionEventsService', [
      'notifyUnauthorized'
    ]);

    TestBed.configureTestingModule({
      providers: [
        { provide: ApiRuntimeConfigService, useValue: runtimeConfig },
        { provide: ApiSessionEventsService, useValue: sessionEvents }
      ]
    });
  });

  function runInterceptor(
    request: HttpRequest<unknown>,
    next: HttpHandlerFn
  ): Observable<HttpEvent<unknown>> {
    return TestBed.runInInjectionContext(() => apiTransportInterceptor(request, next));
  }

  it('whenRequestIsNotRoutedToBackend_shouldForwardOriginalRequest', () => {
    runtimeConfig.shouldRouteToBackend.and.returnValue(false);

    const request = new HttpRequest('GET', '/assets/logo.png');
    let capturedRequest: HttpRequest<unknown> | undefined;

    runInterceptor(request, (nextRequest) => {
      capturedRequest = nextRequest;
      return of(new HttpResponse({ status: 200 }));
    }).subscribe();

    expect(capturedRequest).toBeDefined();
    expect(capturedRequest).toBe(request);
    expect(runtimeConfig.resolveBackendUrl).not.toHaveBeenCalled();
  });

  it('whenRequestIsRoutedToBackend_shouldCloneRequestWithBackendHeadersAndCredentials', () => {
    runtimeConfig.shouldRouteToBackend.and.returnValue(true);
    runtimeConfig.resolveBackendUrl.and.returnValue('https://backend.example.com/properties');

    const request = new HttpRequest('GET', '/properties');
    let capturedRequest: HttpRequest<unknown> | undefined;

    runInterceptor(request, (nextRequest) => {
      capturedRequest = nextRequest;
      return of(new HttpResponse({ status: 200 }));
    }).subscribe();

    expect(capturedRequest).toBeDefined();
    const routedRequest = capturedRequest as HttpRequest<unknown>;
    expect(routedRequest).not.toBe(request);
    expect(routedRequest.url).toBe('https://backend.example.com/properties');
    expect(routedRequest.withCredentials).toBeTrue();
    expect(routedRequest.headers.get('X-Requested-With')).toBe('XMLHttpRequest');
    expect(routedRequest.headers.get('X-Client-Timezone')).toBeTruthy();
  });

  it('whenBrowserTimezoneIsEmpty_shouldUseUtcFallbackHeader', () => {
    runtimeConfig.shouldRouteToBackend.and.returnValue(true);
    runtimeConfig.resolveBackendUrl.and.returnValue('https://backend.example.com/properties');
    spyOn(Intl, 'DateTimeFormat').and.returnValue({
      resolvedOptions: () => ({ timeZone: '' }) as Intl.ResolvedDateTimeFormatOptions
    } as Intl.DateTimeFormat);

    const request = new HttpRequest('GET', '/properties');
    let capturedRequest: HttpRequest<unknown> | undefined;

    runInterceptor(request, (nextRequest) => {
      capturedRequest = nextRequest;
      return of(new HttpResponse({ status: 200 }));
    }).subscribe();

    expect(capturedRequest).toBeDefined();
    expect((capturedRequest as HttpRequest<unknown>).headers.get('X-Client-Timezone')).toBe('UTC');
  });

  it('whenGetRequestFailsWithTransientStatus_shouldRetryAndSucceed', (done) => {
    runtimeConfig.shouldRouteToBackend.and.returnValue(false);

    const request = new HttpRequest('GET', '/properties');
    let attempts = 0;
    let completed = false;

    runInterceptor(request, () =>
      defer(() => {
        attempts += 1;
        if (attempts === 1) {
          return throwError(
            () => new HttpErrorResponse({ status: 503, statusText: 'Service Unavailable' })
          );
        }

        return of(new HttpResponse({ status: 200 }));
      })
    ).subscribe({
      next: (event) => {
        if (event instanceof HttpResponse) {
          expect(attempts).toBe(2);
          expect(event.status).toBe(200);
          completed = true;
          done();
        }
      },
      error: (error) => {
        done.fail(error);
      }
    });

    setTimeout(() => {
      if (!completed) {
        done.fail(`Expected retry to complete successfully. Attempts=${attempts}`);
      }
    }, 1200);
  });

  it('whenErrorIsNotHttpErrorResponse_shouldNotRetry', () => {
    runtimeConfig.shouldRouteToBackend.and.returnValue(false);

    const request = new HttpRequest('GET', '/properties');
    let attempts = 0;
    let emittedError: unknown;

    runInterceptor(request, () => {
      attempts += 1;
      return throwError(() => new Error('boom'));
    }).subscribe({
      error: (error) => {
        emittedError = error;
      }
    });

    expect(attempts).toBe(1);
    expect(emittedError).toEqual(jasmine.any(Error));
  });

  it('whenMethodIsNotRetriable_shouldNotRetryEvenOnTransientStatus', () => {
    runtimeConfig.shouldRouteToBackend.and.returnValue(false);

    const request = new HttpRequest('POST', '/properties', null);
    let attempts = 0;
    let emittedError: unknown;

    runInterceptor(request, () => {
      attempts += 1;
      return throwError(
        () => new HttpErrorResponse({ status: 503, statusText: 'Service Unavailable' })
      );
    }).subscribe({
      error: (error) => {
        emittedError = error;
      }
    });

    expect(attempts).toBe(1);
    expect((emittedError as HttpErrorResponse).status).toBe(503);
  });

  it('whenStatusIsNotTransient_shouldNotRetry', () => {
    runtimeConfig.shouldRouteToBackend.and.returnValue(false);

    const request = new HttpRequest('GET', '/properties');
    let attempts = 0;
    let emittedError: unknown;

    runInterceptor(request, () => {
      attempts += 1;
      return throwError(() => new HttpErrorResponse({ status: 404, statusText: 'Not Found' }));
    }).subscribe({
      error: (error) => {
        emittedError = error;
      }
    });

    expect(attempts).toBe(1);
    expect((emittedError as HttpErrorResponse).status).toBe(404);
  });

  it('whenBackendRequestReturns401_shouldNotifyUnauthorized', () => {
    runtimeConfig.shouldRouteToBackend.and.returnValue(true);
    runtimeConfig.resolveBackendUrl.and.returnValue('https://backend.example.com/auth/session');

    const request = new HttpRequest('GET', '/auth/session');

    runInterceptor(request, () =>
      throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' }))
    ).subscribe({ error: () => undefined });

    expect(sessionEvents.notifyUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('whenNonBackendRequestReturns401_shouldNotNotifyUnauthorized', () => {
    runtimeConfig.shouldRouteToBackend.and.returnValue(false);

    const request = new HttpRequest('GET', '/assets/logo.png');

    runInterceptor(request, () =>
      throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' }))
    ).subscribe({ error: () => undefined });

    expect(sessionEvents.notifyUnauthorized).not.toHaveBeenCalled();
  });

  it('whenBackendRequestFailsWithNonHttpError_shouldNotNotifyUnauthorized', () => {
    runtimeConfig.shouldRouteToBackend.and.returnValue(true);
    runtimeConfig.resolveBackendUrl.and.returnValue('https://backend.example.com/properties');

    const request = new HttpRequest('GET', '/properties');

    runInterceptor(request, () => throwError(() => new Error('non-http-error'))).subscribe({
      error: () => undefined
    });

    expect(sessionEvents.notifyUnauthorized).not.toHaveBeenCalled();
  });
});
