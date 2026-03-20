import { Inject, Injectable, Logger } from '@nestjs/common';
import { PropertyWritePort } from 'ports/outbound/persistence/property-write.port';
import { PROPERTY_WRITE_PORT } from 'ports/outbound/persistence/property-write.port.token';

@Injectable()
export class MarkPropertyClosedUseCase {
  private readonly logger = new Logger(MarkPropertyClosedUseCase.name);

  constructor(
    @Inject(PROPERTY_WRITE_PORT)
    private readonly propertyWritePort: PropertyWritePort
  ) {}

  async execute(url: string, closedBy?: Date): Promise<void> {
    this.logger.warn(`Property URL is no longer available (deactivated-detail): ${url}`);
    await this.propertyWritePort.saveClosedProperty(url, closedBy);
  }
}
