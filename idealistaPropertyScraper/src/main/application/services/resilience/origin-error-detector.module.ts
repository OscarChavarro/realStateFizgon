import { Module } from '@nestjs/common';
import { OriginErrorDetectorService } from 'application/services/resilience/origin-error-detector.service';

@Module({
  providers: [OriginErrorDetectorService],
  exports: [OriginErrorDetectorService]
})
export class OriginErrorDetectorModule {}
