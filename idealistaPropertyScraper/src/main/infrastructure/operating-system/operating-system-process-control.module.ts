import { Global, Module } from '@nestjs/common';
import { OperatingSystemProcessControlService } from 'infrastructure/operating-system/operating-system-process-control.service';
import { OPERATING_SYSTEM_PROCESS_CONTROL_PORT } from 'ports/outbound/operating-system/operating-system-process-control.port.token';

@Global()
@Module({
  providers: [
    OperatingSystemProcessControlService,
    {
      provide: OPERATING_SYSTEM_PROCESS_CONTROL_PORT,
      useExisting: OperatingSystemProcessControlService
    }
  ],
  exports: [OPERATING_SYSTEM_PROCESS_CONTROL_PORT]
})
export class OperatingSystemProcessControlModule {}
