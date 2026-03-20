import { Global, Module } from '@nestjs/common';
import { NodeInputOutputService } from 'infrastructure/input-output/node-input-output.service';
import { INPUT_OUTPUT_FILE_ACCESS_PORT } from 'ports/outbound/input-output/input-output-file-access.port.token';
import { INPUT_OUTPUT_PATH_PORT } from 'ports/outbound/input-output/input-output-path.port.token';

@Global()
@Module({
  providers: [
    NodeInputOutputService,
    {
      provide: INPUT_OUTPUT_PATH_PORT,
      useExisting: NodeInputOutputService
    },
    {
      provide: INPUT_OUTPUT_FILE_ACCESS_PORT,
      useExisting: NodeInputOutputService
    }
  ],
  exports: [INPUT_OUTPUT_PATH_PORT, INPUT_OUTPUT_FILE_ACCESS_PORT]
})
export class InputOutputModule {}
