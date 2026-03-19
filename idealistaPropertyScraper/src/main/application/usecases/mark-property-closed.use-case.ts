import { Inject, Injectable, Logger } from '@nestjs/common';
import { PropertyPersistencePort } from 'src/ports/outbound/persistence/property-persistence.port';
import { PROPERTY_PERSISTENCE_PORT } from 'src/ports/outbound/persistence/property-persistence.port.token';

@Injectable()
export class MarkPropertyClosedUseCase {
  private readonly logger = new Logger(MarkPropertyClosedUseCase.name);

  constructor(
    @Inject(PROPERTY_PERSISTENCE_PORT)
    private readonly propertyPersistencePort: PropertyPersistencePort
  ) {}

  async execute(url: string, closedBy?: Date): Promise<void> {
    this.logger.warn(`Property URL is no longer available (deactivated-detail): ${url}`);
    await this.propertyPersistencePort.saveClosedProperty(url, closedBy);
  }
}
