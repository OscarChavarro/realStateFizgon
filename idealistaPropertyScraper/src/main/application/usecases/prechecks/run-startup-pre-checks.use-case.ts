import { Injectable } from '@nestjs/common';
import { InfrastructurePreCheckService } from 'application/services/prechecks/infrastructure-pre-check.service';

@Injectable()
export class RunStartupPreChecksUseCase {
  constructor(private readonly infrastructurePreCheckService: InfrastructurePreCheckService) {}

  async execute(): Promise<void> {
    await this.infrastructurePreCheckService.runBeforeScraperStartup();
  }
}
