import { Inject, Injectable } from '@nestjs/common';
import { PropertyPersistencePort } from 'ports/outbound/persistence/property-persistence.port';
import { PROPERTY_PERSISTENCE_PORT } from 'ports/outbound/persistence/property-persistence.port.token';

@Injectable()
export class ValidatePersistenceConnectionPreCheckUseCase {
  constructor(
    @Inject(PROPERTY_PERSISTENCE_PORT)
    private readonly propertyPersistencePort: PropertyPersistencePort
  ) {}

  async execute(): Promise<void> {
    await this.propertyPersistencePort.validateConnectionOrExit();
  }
}
