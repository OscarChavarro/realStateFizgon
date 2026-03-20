import { Injectable } from '@nestjs/common';
import { ValidatePersistenceConnectionPreCheckUseCase } from 'src/application/usecases/prechecks/validate-persistence-connection-pre-check.use-case';
import { ValidateImageDownloadFolderPreCheckUseCase } from 'src/application/usecases/prechecks/validate-image-download-folder-pre-check.use-case';
import { ValidateProxyAccessPreCheckUseCase } from 'src/application/usecases/prechecks/validate-proxy-access-pre-check.use-case';

@Injectable()
export class InfrastructurePreCheckService {
  constructor(
    private readonly validateProxyAccessPreCheckUseCase: ValidateProxyAccessPreCheckUseCase,
    private readonly validatePersistenceConnectionPreCheckUseCase: ValidatePersistenceConnectionPreCheckUseCase,
    private readonly validateImageDownloadFolderPreCheckUseCase: ValidateImageDownloadFolderPreCheckUseCase
  ) {}

  async runBeforeScraperStartup(): Promise<void> {
    await this.validateProxyAccessPreCheckUseCase.execute();

    await this.validatePersistenceConnectionPreCheckUseCase.execute();
    await this.validateImageDownloadFolderPreCheckUseCase.execute();
  }
}
