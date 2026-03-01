import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Configuration } from '../../config/configuration';
import { RabbitMqService } from '../rabbitmq/rabbit-mq.service';
import { ImageDownloadPathService } from './image-download-path.service';
import { ImageFileNameService } from './image-file-name.service';

type PendingImageDownloadMessage = {
  url: string;
  propertyId: string;
};

@Injectable()
export class PendingImageDownloadService implements OnModuleInit {
  private readonly logger = new Logger(PendingImageDownloadService.name);

  constructor(
    private readonly configuration: Configuration,
    private readonly rabbitMqService: RabbitMqService,
    private readonly imageDownloadPathService: ImageDownloadPathService,
    private readonly imageFileNameService: ImageFileNameService
  ) {}

  async onModuleInit(): Promise<void> {
    await this.validateImageDownloadFolder();
    await this.rabbitMqService.consumeMessages(async (message) => {
      await this.processPendingImageMessage(message);
    });
  }

  private async validateImageDownloadFolder(): Promise<void> {
    const configuredFolder = this.configuration.imageDownloadFolder;
    const waitMs = this.configuration.startupFolderValidationRetryWaitMs;
    const waitSeconds = Math.floor(waitMs / 1000);

    while (true) {
      try {
        this.imageDownloadPathService.ensureWritableFolders(configuredFolder);
        this.logger.log(`Image download folder is ready: ${configuredFolder}`);
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Image download folder validation failed: ${message}`);
        this.logger.error(`Check permissions, free disk space, and path configured in environment.json: "${configuredFolder}".`);
        this.logger.error(
          `NFS/shared-folder access is failing. Keeping pod alive for ${waitSeconds} seconds before retrying validation.`
        );
        await this.sleep(waitMs);
      }
    }
  }

  private async processPendingImageMessage(message: unknown): Promise<void> {
    const payload = this.assertPendingImageMessage(message);
    const targetFolderPath = join(
      this.imageDownloadPathService.getDownloadFolderPath(this.configuration.imageDownloadFolder),
      payload.propertyId
    );
    await mkdir(targetFolderPath, { recursive: true });

    const filename = this.imageFileNameService.buildFilenameFromUrl(payload.url);
    const targetFilePath = join(targetFolderPath, filename);
    const imageData = await this.downloadImage(payload.url);
    try {
      await writeFile(targetFilePath, imageData, { flag: 'wx' });
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === 'EEXIST') {
        this.logger.log(`Image already exists. Skipping overwrite for URL: ${payload.url}`);
        return;
      }

      throw error;
    }

    this.logger.log(`Image saved: propertyId=${payload.propertyId}, file=${filename}`);
  }

  private assertPendingImageMessage(message: unknown): PendingImageDownloadMessage {
    if (typeof message !== 'object' || message === null) {
      throw new Error('Invalid pending image message. Expected JSON object.');
    }

    const candidate = message as Partial<PendingImageDownloadMessage>;
    const url = typeof candidate.url === 'string' ? candidate.url.trim() : '';
    const propertyId = typeof candidate.propertyId === 'string' ? candidate.propertyId.trim() : '';

    if (!url) {
      throw new Error('Invalid pending image message: "url" is required.');
    }

    if (!propertyId) {
      throw new Error('Invalid pending image message: "propertyId" is required.');
    }

    return { url, propertyId };
  }

  private async downloadImage(url: string): Promise<Buffer> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.configuration.downloadRequestTimeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const bytes = Buffer.from(arrayBuffer);
      if (bytes.length === 0) {
        throw new Error('Downloaded image body is empty.');
      }

      return bytes;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed downloading "${url}": ${message}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
