import { Inject, Injectable } from '@nestjs/common';
import { ImageDownloader } from 'src/application/services/imagedownload/image-downloader';
import { ValidateProxyAccessPreCheckUseCase } from 'src/application/usecases/prechecks/validate-proxy-access-pre-check.use-case';
import { PropertyPersistencePort } from 'src/ports/outbound/persistence/property-persistence.port';
import { PROPERTY_PERSISTENCE_PORT } from 'src/ports/outbound/persistence/property-persistence.port.token';

@Injectable()
export class InfrastructurePreCheckService {
  constructor(
    private readonly validateProxyAccessPreCheckUseCase: ValidateProxyAccessPreCheckUseCase,
    @Inject(PROPERTY_PERSISTENCE_PORT)
    private readonly propertyPersistencePort: PropertyPersistencePort,
    private readonly imageDownloader: ImageDownloader
  ) {}

  async runBeforeScraperStartup(): Promise<void> {
    await this.validateProxyAccessPreCheckUseCase.execute();

    await this.propertyPersistencePort.validateConnectionOrExit();
    await this.imageDownloader.validateImageDownloadFolder();
  }
}
