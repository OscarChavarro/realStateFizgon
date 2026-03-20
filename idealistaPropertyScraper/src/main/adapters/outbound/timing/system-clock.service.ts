import { Injectable } from '@nestjs/common';

import type { ClockPort } from 'ports/outbound/timing/clock.port';

@Injectable()
export class SystemClockService implements ClockPort {
  nowMs(): number {
    return Date.now();
  }
}
