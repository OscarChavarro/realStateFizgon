import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageUrlRulesService } from './image-url-rules.service';

@Injectable()
export class ImageFileNameService {
  constructor(private readonly imageUrlRulesService: ImageUrlRulesService) {}

  buildImageFilename(url: string, mimeType: string): string {
    const hash = createHash('sha1').update(url).digest('hex');
    const extension = this.resolveImageExtension(url, mimeType);
    return `${Date.now()}-${hash}${extension}`;
  }

  resolveImageExtension(url: string, mimeType: string): string {
    const pathname = this.imageUrlRulesService.safeUrlPathname(url);
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

  async buildCompatibleTargetFilename(propertyFolderPath: string, imageUrl: string, downloadedExtension: string): Promise<string> {
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
}
