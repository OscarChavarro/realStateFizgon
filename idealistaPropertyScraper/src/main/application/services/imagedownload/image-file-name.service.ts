import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ImageUrlRulesService } from 'application/services/imagedownload/image-url-rules.service';
import { INPUT_OUTPUT_FILE_ACCESS_PORT } from 'ports/outbound/input-output/input-output-file-access.port.token';

import type { InputOutputFileAccessPort } from 'ports/outbound/input-output/input-output-file-access.port';

@Injectable()
export class ImageFileNameService {
  constructor(
    private readonly imageUrlRulesService: ImageUrlRulesService,
    @Inject(INPUT_OUTPUT_FILE_ACCESS_PORT)
    private readonly inputOutputFileAccessPort: InputOutputFileAccessPort
  ) {}

  buildImageFilename(url: string, mimeType: string): string {
    const hash = createHash('sha1').update(url).digest('hex');
    const extension = this.resolveImageExtension(url, mimeType);
    return `${Date.now()}-${hash}${extension}`;
  }

  resolveImageExtension(url: string, mimeType: string): string {
    const pathname = this.imageUrlRulesService.safeUrlPathname(url);
    const lastSegment = pathname.slice(pathname.lastIndexOf('/') + 1);
    const extensionFromUrl = this.normalizeExtension(lastSegment.includes('.') ? lastSegment.slice(lastSegment.lastIndexOf('.') + 1) : '');
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

  buildCompatibleTargetFilename(imageUrl: string, downloadedExtension: string): string {
    const baseName = this.buildCompatibleBaseName(imageUrl);
    const expectedExtension = this.resolveImageExtension(imageUrl, '');
    const preferredExtension = expectedExtension === '.img' ? downloadedExtension : expectedExtension;
    const extension = preferredExtension || '.img';

    return `${baseName}${extension}`;
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

  private buildCompatibleBaseName(imageUrl: string): string {
    try {
      const url = new URL(imageUrl);
      const parts = url.pathname.split('/').filter(Boolean);
      const last = parts[parts.length - 1] ?? 'image';
      const nameNoExt = last.includes('.') ? last.slice(0, last.lastIndexOf('.')) : last;

      if (parts.length >= 4) {
        const p1 = this.sanitizeFileSegment(parts[parts.length - 4]);
        const p2 = this.sanitizeFileSegment(parts[parts.length - 3]);
        const p3 = this.sanitizeFileSegment(parts[parts.length - 2]);
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

  async pathExists(path: string): Promise<boolean> {
    return this.inputOutputFileAccessPort.pathExists(path);
  }
}
