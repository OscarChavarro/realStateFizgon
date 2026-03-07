import { Module } from '@nestjs/common';
import { OriginErrorDetectorService } from 'src/application/services/scraper/origin-error-detector.service';

@Module({
  providers: [OriginErrorDetectorService],
  exports: [OriginErrorDetectorService]
})
export class OriginErrorDetectorModule {}
