import { Injectable } from '@nestjs/common';
import { toErrorMessage } from 'infrastructure/error-message';

import type { ErrorMessagePort } from 'ports/outbound/observability/error-message.port';

@Injectable()
export class ErrorMessageService implements ErrorMessagePort {
  toErrorMessage(error: unknown): string {
    return toErrorMessage(error);
  }
}
