import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiSessionEventsService {
  private static readonly MIN_UNAUTHORIZED_EVENT_INTERVAL_MS = 1500;

  private readonly unauthorizedSubject = new Subject<void>();
  private lastUnauthorizedAtMs = 0;

  get unauthorized$(): Observable<void> {
    return this.unauthorizedSubject.asObservable();
  }

  notifyUnauthorized(): void {
    const now = Date.now();
    if (
      now - this.lastUnauthorizedAtMs <
      ApiSessionEventsService.MIN_UNAUTHORIZED_EVENT_INTERVAL_MS
    ) {
      return;
    }

    this.lastUnauthorizedAtMs = now;
    this.unauthorizedSubject.next();
  }
}
