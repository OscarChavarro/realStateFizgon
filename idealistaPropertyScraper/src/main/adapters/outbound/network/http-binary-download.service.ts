import { Injectable } from '@nestjs/common';

import type {
  HttpBinaryDownloadPort,
  HttpBinaryDownloadResult
} from 'ports/outbound/network/http-binary-download.port';

@Injectable()
export class HttpBinaryDownloadService implements HttpBinaryDownloadPort {
  async download(url: string): Promise<HttpBinaryDownloadResult> {
    const response = await fetch(url);
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        bytes: Buffer.alloc(0)
      };
    }

    const body = await response.arrayBuffer();
    return {
      ok: true,
      status: response.status,
      bytes: Buffer.from(body)
    };
  }
}
