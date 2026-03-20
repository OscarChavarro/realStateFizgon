import type { RequestPropertiesCommandResult } from 'ports/inbound/http/request-properties-command-result.contract';

export interface RequestUpdatePropertiesPort {
  execute(): RequestPropertiesCommandResult;
}
