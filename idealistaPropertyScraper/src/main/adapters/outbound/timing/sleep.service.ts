import { Injectable } from '@nestjs/common';
import { sleep } from 'infrastructure/sleep';

import type { SleepPort } from 'ports/outbound/timing/sleep.port';

@Injectable()
export class SleepService implements SleepPort {
  async sleep(ms: number): Promise<void> {
    await sleep(ms);
  }
}
