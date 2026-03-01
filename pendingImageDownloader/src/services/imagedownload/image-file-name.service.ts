import { Injectable } from '@nestjs/common';

@Injectable()
export class ImageFileNameService {
  buildFilenameFromUrl(url: string): string {
    const parsedUrl = new URL(url);
    const segments = parsedUrl.pathname.split('/').filter((segment) => segment.length > 0);
    const lastFourSegments = segments.slice(-4);

    if (lastFourSegments.length < 4) {
      throw new Error(`Cannot generate filename from URL. Expected at least 4 path tokens: ${url}`);
    }

    return lastFourSegments.join('_');
  }
}

