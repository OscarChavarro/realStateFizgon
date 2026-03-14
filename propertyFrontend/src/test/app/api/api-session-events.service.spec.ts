import { ApiSessionEventsService } from 'src/app/api/api-session-events.service';

describe('ApiSessionEventsService', () => {
  let service: ApiSessionEventsService;

  beforeEach(() => {
    service = new ApiSessionEventsService();
  });

  it('whenNotifyUnauthorizedIsCalledFirstTime_shouldEmitEvent', () => {
    const emitted: number[] = [];
    service.unauthorized$.subscribe(() => emitted.push(1));
    spyOn(Date, 'now').and.returnValue(2000);

    service.notifyUnauthorized();

    expect(emitted.length).toBe(1);
  });

  it('whenNotifyUnauthorizedIsCalledTooSoon_shouldNotEmitEvent', () => {
    const emitted: number[] = [];
    service.unauthorized$.subscribe(() => emitted.push(1));
    spyOn(Date, 'now').and.returnValues(2000, 3000);

    service.notifyUnauthorized();
    service.notifyUnauthorized();

    expect(emitted.length).toBe(1);
  });

  it('whenNotifyUnauthorizedIsCalledAfterInterval_shouldEmitAgain', () => {
    const emitted: number[] = [];
    service.unauthorized$.subscribe(() => emitted.push(1));
    spyOn(Date, 'now').and.returnValues(2000, 3601);

    service.notifyUnauthorized();
    service.notifyUnauthorized();

    expect(emitted.length).toBe(2);
  });
});
