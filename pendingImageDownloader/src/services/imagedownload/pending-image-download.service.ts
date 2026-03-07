import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Configuration } from 'src/config/configuration';
import { RabbitMqService } from 'src/services/rabbitmq/rabbit-mq.service';
import { ImageDownloadPathService } from 'src/services/imagedownload/image-download-path.service';
import { ImageFileNameService } from 'src/services/imagedownload/image-file-name.service';
import { RabbitMessageProcessingError } from 'src/services/rabbitmq/rabbit-message-processing.error';

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
    const imageData = await this.downloadImageWithRetry(payload.url);
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
      throw new RabbitMessageProcessingError('Invalid pending image message. Expected JSON object.', false);
    }

    const candidate = message as Partial<PendingImageDownloadMessage>;
    const url = typeof candidate.url === 'string' ? candidate.url.trim() : '';
    const propertyId = typeof candidate.propertyId === 'string' ? candidate.propertyId.trim() : '';

    if (!url) {
      throw new RabbitMessageProcessingError('Invalid pending image message: "url" is required.', false);
    }

    if (!propertyId) {
      throw new RabbitMessageProcessingError('Invalid pending image message: "propertyId" is required.', false);
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

  private async downloadImageWithRetry(url: string): Promise<Buffer> {
    const maxAttempts = this.configuration.downloadRetryAttempts;
    const retryWaitMs = this.configuration.downloadRetryWaitMs;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.downloadImage(url);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt >= maxAttempts) {
          break;
        }

        this.logger.warn(
          `Failed downloading "${url}" (attempt ${attempt}/${maxAttempts}). Retrying in ${retryWaitMs}ms. Error: ${lastError.message}`
        );
        await this.sleep(retryWaitMs);
      }
    }

    const message = lastError?.message ?? `Failed downloading "${url}"`;
    throw new RabbitMessageProcessingError(
      `Retries exhausted for "${url}" after ${maxAttempts} attempts. ${message}`,
      false
    );
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
