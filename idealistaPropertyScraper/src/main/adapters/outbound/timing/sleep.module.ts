import { Module } from '@nestjs/common';
import { SleepService } from 'adapters/outbound/timing/sleep.service';
import { SystemClockService } from 'adapters/outbound/timing/system-clock.service';
import { CLOCK_PORT } from 'ports/outbound/timing/clock.port.token';
import { SLEEP_PORT } from 'ports/outbound/timing/sleep.port.token';

@Module({
  providers: [
    SystemClockService,
    SleepService,
    {
      provide: CLOCK_PORT,
      useExisting: SystemClockService
    },
    {
      provide: SLEEP_PORT,
      useExisting: SleepService
    }
  ],
  exports: [SleepService, SystemClockService, CLOCK_PORT, SLEEP_PORT]
})
export class SleepModule {}
