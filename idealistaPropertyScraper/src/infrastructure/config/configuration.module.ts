import { Module } from '@nestjs/common';
import { Configuration } from 'src/infrastructure/config/configuration';

@Module({
  providers: [Configuration],
  exports: [Configuration]
})
export class ConfigurationModule {}
