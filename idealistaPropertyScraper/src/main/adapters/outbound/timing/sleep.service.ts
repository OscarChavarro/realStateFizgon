import { Injectable } from '@nestjs/common';
import { sleep } from 'src/infrastructure/sleep';

import type { SleepPort } from 'src/ports/outbound/timing/sleep.port';

@Injectable()
export class SleepService implements SleepPort {
  async sleep(ms: number): Promise<void> {
    await sleep(ms);
  }
}
