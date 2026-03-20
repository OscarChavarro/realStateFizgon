import { Module } from '@nestjs/common';
import { FileSystemService } from 'src/adapters/outbound/filesystem/file-system.service';
import { FILE_SYSTEM_PORT } from 'src/ports/outbound/filesystem/file-system.port.token';

@Module({
  providers: [
    FileSystemService,
    {
      provide: FILE_SYSTEM_PORT,
      useExisting: FileSystemService
    }
  ],
  exports: [FileSystemService, FILE_SYSTEM_PORT]
})
export class FileSystemModule {}
