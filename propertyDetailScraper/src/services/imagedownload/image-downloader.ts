import { Injectable, Logger } from '@nestjs/common';
import { constants, existsSync, mkdirSync, accessSync, writeFileSync, unlinkSync } from 'node:fs';
import { writeFile, readdir, mkdir, rename, rm, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { Configuration } from '../../config/configuration';
import { Property } from '../../model/property/property.model';

type NetworkResponseReceivedEvent = {
  requestId: string;
  type?: string;
  response: {
    url: string;
    mimeType?: string;
  };
};

type NetworkLoadingFinishedEvent = {
  requestId: string;
};

type NetworkLoadingFailedEvent = {
  requestId: string;
};

type NetworkDomain = {
  enable(): Promise<void>;
  responseReceived(callback: (event: unknown) => void): void;
  loadingFinished(callback: (event: unknown) => void): void;
  loadingFailed(callback: (event: unknown) => void): void;
  getResponseBody(params: { requestId: string }): Promise<{ body: string; base64Encoded: boolean }>;
};

type NetworkEnabledCdpClient = {
  Network: NetworkDomain;
};

type DownloadedIncomingImage = {
  url: string;
  path: string;
  extension: string;
};

@Injectable()
export class ImageDownloader {
  private readonly logger = new Logger(ImageDownloader.name);
  private readonly pendingImageRequests = new Map<string, { url: string; mimeType: string }>();
  private readonly initializedClients = new WeakSet<object>();
  private readonly incomingImagesByKey = new Map<string, DownloadedIncomingImage[]>();

  constructor(private readonly configuration: Configuration) {}

  validateImageDownloadFolder(): void {
    const configuredFolder = this.configuration.imageDownloadFolder;
    const folderPath = resolve(process.cwd(), configuredFolder);
    const incomingFolderPath = join(folderPath, '_incoming');
    const leftoversFolderPath = join(folderPath, '_leftovers');

    try {
      if (!existsSync(folderPath)) {
        mkdirSync(folderPath, { recursive: true });
      }
      if (!existsSync(incomingFolderPath)) {
        mkdirSync(incomingFolderPath, { recursive: true });
      }
      if (!existsSync(leftoversFolderPath)) {
        mkdirSync(leftoversFolderPath, { recursive: true });
      }

      accessSync(folderPath, constants.R_OK | constants.W_OK);
      accessSync(incomingFolderPath, constants.R_OK | constants.W_OK);
      accessSync(leftoversFolderPath, constants.R_OK | constants.W_OK);

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

  async initializeNetworkCapture(client: NetworkEnabledCdpClient): Promise<void> {
    if (this.initializedClients.has(client)) {
      return;
    }

    await client.Network.enable();
    this.initializedClients.add(client);

    client.Network.responseReceived((event) => {
      this.handleResponseReceived(event as NetworkResponseReceivedEvent);
    });

    client.Network.loadingFinished((event) => {
      this.handleLoadingFinished(client.Network, event as NetworkLoadingFinishedEvent);
    });

    client.Network.loadingFailed((event) => {
      this.pendingImageRequests.delete((event as NetworkLoadingFailedEvent).requestId);
    });
  }

  async waitForPendingImageDownloads(timeoutMs = 5000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (this.pendingImageRequests.size === 0) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  async movePropertyImagesFromIncoming(property: Property): Promise<void> {
    const propertyId = this.extractPropertyIdFromUrl(property.url);
    if (!propertyId) {
      this.logger.error(`Unable to extract property id from URL: ${property.url}`);
      return;
    }

    const incomingFolderPath = this.getIncomingFolderPath();
    const propertyFolderPath = join(this.getDownloadFolderPath(), propertyId);
    await mkdir(propertyFolderPath, { recursive: true });

    for (const image of property.images) {
      if (!this.shouldTrackImageUrl(image.url)) {
        continue;
      }

      const key = this.extractCanonicalImageKey(image.url);
      if (!key) {
        this.logger.error(`Image URL cannot be normalized to a key: ${image.url}`);
        continue;
      }

      const candidates = this.incomingImagesByKey.get(key);

      if (!candidates || candidates.length === 0) {
        this.logger.error(`Image URL was not downloaded and cannot be moved: ${image.url}`);
        continue;
      }

      const selectedFile = candidates.shift();
      if (!selectedFile) {
        this.logger.error(`Image URL was not downloaded and cannot be moved: ${image.url}`);
        continue;
      }

      const sourcePath = selectedFile.path;
      const targetFilename = await this.buildCompatibleTargetFilename(propertyFolderPath, image.url, selectedFile.extension);
      const targetPath = join(propertyFolderPath, targetFilename);

      try {
        await rename(sourcePath, targetPath);
      } catch {
        this.logger.error(`Failed moving image for URL: ${image.url}`);
      }
    }

    await this.moveRemainingIncomingToLeftovers(incomingFolderPath);
    this.incomingImagesByKey.clear();
    this.pendingImageRequests.clear();
  }

  private handleResponseReceived(event: NetworkResponseReceivedEvent): void {
    const responseType = (event.type ?? '').toLowerCase();
    const url = event.response.url ?? '';
    const mimeType = event.response.mimeType ?? '';

    if (responseType !== 'image') {
      return;
    }
    if (!this.isIdealistaDomain(url)) {
      return;
    }
    this.pendingImageRequests.set(event.requestId, { url, mimeType });
  }

  private handleLoadingFinished(network: NetworkDomain, event: NetworkLoadingFinishedEvent): void {
    const pending = this.pendingImageRequests.get(event.requestId);
    if (!pending) {
      return;
    }

    this.pendingImageRequests.delete(event.requestId);
    void this.downloadFromNetworkBody(network, event.requestId, pending.url, pending.mimeType);
  }

  private async downloadFromNetworkBody(network: NetworkDomain, requestId: string, url: string, mimeType: string): Promise<void> {
    try {
      if (!this.shouldTrackImageUrl(url) || this.isSvgImage(url, mimeType)) {
        return;
      }

      const body = await network.getResponseBody({ requestId });
      const bytes = body.base64Encoded
        ? Buffer.from(body.body, 'base64')
        : Buffer.from(body.body, 'binary');
      if (bytes.length === 0) {
        return;
      }

      const incomingFolderPath = this.getIncomingFolderPath();
      const filename = this.buildImageFilename(url, mimeType);
      const filepath = join(incomingFolderPath, filename);
      await writeFile(filepath, bytes);

      const key = this.extractCanonicalImageKey(url);
      if (!key) {
        return;
      }

      const extension = this.resolveImageExtension(url, mimeType);
      const list = this.incomingImagesByKey.get(key) ?? [];
      list.push({
        url,
        path: filepath,
        extension
      });
      this.incomingImagesByKey.set(key, list);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Unable to capture image from CDP network (${url}): ${message}`);
    }
  }

  private buildImageFilename(url: string, mimeType: string): string {
    const hash = createHash('sha1').update(url).digest('hex');
    const extension = this.resolveImageExtension(url, mimeType);
    return `${Date.now()}-${hash}${extension}`;
  }

  private resolveImageExtension(url: string, mimeType: string): string {
    const pathname = this.safeUrlPathname(url);
    const lastSegment = pathname.split('/').pop() ?? '';
    const extensionFromUrl = this.normalizeExtension(lastSegment.includes('.') ? lastSegment.split('.').pop() ?? '' : '');
    if (extensionFromUrl) {
      return extensionFromUrl;
    }

    const mime = mimeType.toLowerCase();
    if (mime.includes('jpeg') || mime.includes('jpg')) {
      return '.jpg';
    }
    if (mime.includes('png')) {
      return '.png';
    }
    if (mime.includes('webp')) {
      return '.webp';
    }
    if (mime.includes('gif')) {
      return '.gif';
    }
    if (mime.includes('svg')) {
      return '.svg';
    }

    return '.img';
  }

  private normalizeExtension(extension: string): string {
    const clean = extension.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!clean) {
      return '';
    }
    if (clean === 'jpeg') {
      return '.jpg';
    }
    return `.${clean}`;
  }

  private isSvgImage(url: string, mimeType: string): boolean {
    if (mimeType.toLowerCase().includes('image/svg+xml')) {
      return true;
    }

    const pathname = this.safeUrlPathname(url).toLowerCase();
    return pathname.endsWith('.svg');
  }

  private safeUrlPathname(rawUrl: string): string {
    try {
      return new URL(rawUrl).pathname;
    } catch {
      return '';
    }
  }

  private shouldTrackImageUrl(rawUrl: string): boolean {
    if (!this.isIdealistaDomain(rawUrl)) {
      return false;
    }
    if (!this.isBlurImageUrl(rawUrl)) {
      return false;
    }

    const url = rawUrl.toLowerCase();
    if (url.includes('/loading.gif') || url.includes('/loading-mobile.gif')) {
      return false;
    }

    return true;
  }

  private isIdealistaDomain(rawUrl: string): boolean {
    try {
      const hostname = new URL(rawUrl).hostname.toLowerCase();
      return hostname === 'idealista.com' || hostname.endsWith('.idealista.com');
    } catch {
      return false;
    }
  }

  private isBlurImageUrl(rawUrl: string): boolean {
    try {
      const url = new URL(rawUrl);
      return url.pathname.toLowerCase().includes('/blur/');
    } catch {
      return false;
    }
  }

  private extractPropertyIdFromUrl(url: string): string | null {
    const match = url.match(/\/inmueble\/(\d+)\//i);
    return match?.[1] ?? null;
  }

  private async moveRemainingIncomingToLeftovers(incomingFolderPath: string): Promise<void> {
    const leftoversFolderPath = this.getLeftoversFolderPath();
    await mkdir(leftoversFolderPath, { recursive: true });
    const entries = await readdir(incomingFolderPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = join(incomingFolderPath, entry.name);
      if (entry.isFile()) {
        const targetPath = join(leftoversFolderPath, entry.name);
        await rm(targetPath, { force: true });
        await rename(entryPath, targetPath);
        continue;
      }

      if (entry.isDirectory()) {
        await rm(entryPath, { recursive: true, force: true });
      }
    }
  }

  private extractCanonicalImageKey(rawUrl: string): string | null {
    try {
      const url = new URL(rawUrl);
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length === 0) {
        return null;
      }

      const last = parts[parts.length - 1] ?? '';
      const baseNoExt = last.includes('.') ? last.slice(0, last.lastIndexOf('.')) : last;
      if (!baseNoExt) {
        return null;
      }

      if (parts.length >= 4) {
        const p1 = parts[parts.length - 4];
        const p2 = parts[parts.length - 3];
        const p3 = parts[parts.length - 2];
        return `${p1}/${p2}/${p3}/${baseNoExt}`.toLowerCase();
      }

      return baseNoExt.toLowerCase();
    } catch {
      return null;
    }
  }

  private async buildCompatibleTargetFilename(propertyFolderPath: string, imageUrl: string, downloadedExtension: string): Promise<string> {
    const baseName = this.buildCompatibleBaseName(imageUrl);
    const expectedExtension = this.resolveImageExtension(imageUrl, '');
    const preferredExtension = expectedExtension === '.img' ? downloadedExtension : expectedExtension;
    const extension = preferredExtension || downloadedExtension || '.img';

    let candidate = `${baseName}${extension}`;
    let counter = 1;
    while (await this.pathExists(join(propertyFolderPath, candidate))) {
      candidate = `${baseName}-${counter}${extension}`;
      counter += 1;
    }

    return candidate;
  }

  private buildCompatibleBaseName(imageUrl: string): string {
    try {
      const url = new URL(imageUrl);
      const parts = url.pathname.split('/').filter(Boolean);
      const last = parts[parts.length - 1] ?? 'image';
      const nameNoExt = last.includes('.') ? last.slice(0, last.lastIndexOf('.')) : last;

      if (parts.length >= 4) {
        const p1 = this.sanitizeFileSegment(parts[parts.length - 4] ?? '');
        const p2 = this.sanitizeFileSegment(parts[parts.length - 3] ?? '');
        const p3 = this.sanitizeFileSegment(parts[parts.length - 2] ?? '');
        const p4 = this.sanitizeFileSegment(nameNoExt);
        return `${p1}_${p2}_${p3}_${p4}`;
      }

      return this.sanitizeFileSegment(nameNoExt);
    } catch {
      return createHash('sha1').update(imageUrl).digest('hex');
    }
  }

  private sanitizeFileSegment(value: string): string {
    return value.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  private async pathExists(path: string): Promise<boolean> {
    try {
      await access(path, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  private getDownloadFolderPath(): string {
    return resolve(process.cwd(), this.configuration.imageDownloadFolder);
  }

  private getIncomingFolderPath(): string {
    return join(this.getDownloadFolderPath(), '_incoming');
  }

  private getLeftoversFolderPath(): string {
    return join(this.getDownloadFolderPath(), '_leftovers');
  }
}
