import { Inject, Injectable } from '@nestjs/common';
import { PersistenceHealthPort } from 'ports/outbound/persistence/persistence-health.port';
import { PERSISTENCE_HEALTH_PORT } from 'ports/outbound/persistence/persistence-health.port.token';

@Injectable()
export class ValidatePersistenceConnectionPreCheckUseCase {
  constructor(
    @Inject(PERSISTENCE_HEALTH_PORT)
    private readonly persistenceHealthPort: PersistenceHealthPort
  ) {}

  async execute(): Promise<void> {
    await this.persistenceHealthPort.validateConnectionOrExit();
  }
}
