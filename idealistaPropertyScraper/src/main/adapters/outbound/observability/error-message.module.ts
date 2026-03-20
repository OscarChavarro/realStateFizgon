import { Module } from '@nestjs/common';
import { ErrorMessageService } from 'src/adapters/outbound/observability/error-message.service';
import { ERROR_MESSAGE_PORT } from 'src/ports/outbound/observability/error-message.port.token';

@Module({
  providers: [
    ErrorMessageService,
    {
      provide: ERROR_MESSAGE_PORT,
      useExisting: ErrorMessageService
    }
  ],
  exports: [ErrorMessageService, ERROR_MESSAGE_PORT]
})
export class ErrorMessageModule {}
