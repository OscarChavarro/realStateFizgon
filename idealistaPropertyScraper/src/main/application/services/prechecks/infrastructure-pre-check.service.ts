import { Injectable } from '@nestjs/common';
import { ImageDownloader } from 'src/application/services/imagedownload/image-downloader';
import { ValidatePersistenceConnectionPreCheckUseCase } from 'src/application/usecases/prechecks/validate-persistence-connection-pre-check.use-case';
import { ValidateProxyAccessPreCheckUseCase } from 'src/application/usecases/prechecks/validate-proxy-access-pre-check.use-case';

@Injectable()
export class InfrastructurePreCheckService {
  constructor(
    private readonly validateProxyAccessPreCheckUseCase: ValidateProxyAccessPreCheckUseCase,
    private readonly validatePersistenceConnectionPreCheckUseCase: ValidatePersistenceConnectionPreCheckUseCase,
    private readonly imageDownloader: ImageDownloader
  ) {}

  async runBeforeScraperStartup(): Promise<void> {
    await this.validateProxyAccessPreCheckUseCase.execute();

    await this.validatePersistenceConnectionPreCheckUseCase.execute();
    await this.imageDownloader.validateImageDownloadFolder();
  }
}
