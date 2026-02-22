import { Injectable, Logger } from '@nestjs/common';
import { constants, existsSync, mkdirSync, accessSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Configuration } from '../../config/configuration';

@Injectable()
export class ImageDownloader {
  private readonly logger = new Logger(ImageDownloader.name);

  constructor(private readonly configuration: Configuration) {}

  validateImageDownloadFolder(): void {
    const configuredFolder = this.configuration.imageDownloadFolder;
    const folderPath = resolve(process.cwd(), configuredFolder);
    const incomingFolderPath = join(folderPath, '_incoming');

    try {
      if (!existsSync(folderPath)) {
        mkdirSync(folderPath, { recursive: true });
      }
      if (!existsSync(incomingFolderPath)) {
        mkdirSync(incomingFolderPath, { recursive: true });
      }

      accessSync(folderPath, constants.R_OK | constants.W_OK);
      accessSync(incomingFolderPath, constants.R_OK | constants.W_OK);

      const probeFile = join(incomingFolderPath, `.write-probe-${Date.now()}.tmp`);
      writeFileSync(probeFile, 'ok');
      unlinkSync(probeFile);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Image download folder validation failed: ${message}`);
      this.logger.error(`Check permissions, free disk space, and path configured in environment.json: "${configuredFolder}".`);
      process.exit(1);
    }
  }
}
