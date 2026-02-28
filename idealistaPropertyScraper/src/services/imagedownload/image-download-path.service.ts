import { Injectable } from '@nestjs/common';
import { constants, accessSync, existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

@Injectable()
export class ImageDownloadPathService {
  ensureWritableFolders(downloadFolder: string): void {
    const folderPath = this.getDownloadFolderPath(downloadFolder);
    const incomingFolderPath = this.getIncomingFolderPath(downloadFolder);
    const leftoversFolderPath = this.getLeftoversFolderPath(downloadFolder);

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
  }

  getDownloadFolderPath(downloadFolder: string): string {
    return resolve(process.cwd(), downloadFolder);
  }

  getIncomingFolderPath(downloadFolder: string): string {
    return join(this.getDownloadFolderPath(downloadFolder), '_incoming');
  }

  getLeftoversFolderPath(downloadFolder: string): string {
    return join(this.getDownloadFolderPath(downloadFolder), '_leftovers');
  }
}
