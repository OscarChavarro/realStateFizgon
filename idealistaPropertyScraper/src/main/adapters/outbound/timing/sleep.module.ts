import { Module } from '@nestjs/common';
import { SleepService } from 'adapters/outbound/timing/sleep.service';
import { SLEEP_PORT } from 'ports/outbound/timing/sleep.port.token';

@Module({
  providers: [
    SleepService,
    {
      provide: SLEEP_PORT,
      useExisting: SleepService
    }
  ],
  exports: [SleepService, SLEEP_PORT]
})
export class SleepModule {}
