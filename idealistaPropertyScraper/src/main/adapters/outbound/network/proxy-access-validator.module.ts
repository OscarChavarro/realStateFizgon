import { Module } from '@nestjs/common';
import { ProxyAccessValidatorService } from 'adapters/outbound/network/proxy-access-validator.service';
import { PROXY_ACCESS_VALIDATOR_PORT } from 'ports/outbound/network/proxy-access-validator.port.token';

@Module({
  providers: [
    ProxyAccessValidatorService,
    {
      provide: PROXY_ACCESS_VALIDATOR_PORT,
      useExisting: ProxyAccessValidatorService
    }
  ],
  exports: [ProxyAccessValidatorService, PROXY_ACCESS_VALIDATOR_PORT]
})
export class ProxyAccessValidatorModule {}
