import { Inject, Injectable } from '@nestjs/common';
import { INPUT_OUTPUT_FILE_ACCESS_PORT } from 'ports/outbound/input-output/input-output-file-access.port.token';
import { INPUT_OUTPUT_PATH_PORT } from 'ports/outbound/input-output/input-output-path.port.token';

import type { InputOutputFileAccessPort } from 'ports/outbound/input-output/input-output-file-access.port';
import type { InputOutputPathPort } from 'ports/outbound/input-output/input-output-path.port';

@Injectable()
export class ImageDownloadPathService {
  constructor(
    @Inject(INPUT_OUTPUT_PATH_PORT)
    private readonly inputOutputPathPort: InputOutputPathPort,
    @Inject(INPUT_OUTPUT_FILE_ACCESS_PORT)
    private readonly inputOutputFileAccessPort: InputOutputFileAccessPort
  ) {}

  ensureWritableFolders(downloadFolder: string): void {
    const folderPath = this.getDownloadFolderPath(downloadFolder);
    const incomingFolderPath = this.getIncomingFolderPath(downloadFolder);
    const leftoversFolderPath = this.getLeftoversFolderPath(downloadFolder);

    if (!this.inputOutputFileAccessPort.fileExists(folderPath)) {
      this.inputOutputFileAccessPort.ensureDirectory(folderPath);
    }
    if (!this.inputOutputFileAccessPort.fileExists(incomingFolderPath)) {
      this.inputOutputFileAccessPort.ensureDirectory(incomingFolderPath);
    }
    if (!this.inputOutputFileAccessPort.fileExists(leftoversFolderPath)) {
      this.inputOutputFileAccessPort.ensureDirectory(leftoversFolderPath);
    }

    this.inputOutputFileAccessPort.assertReadableWritable(folderPath);
    this.inputOutputFileAccessPort.assertReadableWritable(incomingFolderPath);
    this.inputOutputFileAccessPort.assertReadableWritable(leftoversFolderPath);

    const probeFile = this.inputOutputPathPort.join(incomingFolderPath, `.write-probe-${Date.now()}.tmp`);
    this.inputOutputFileAccessPort.writeTextFile(probeFile, 'ok');
    this.inputOutputFileAccessPort.deleteFile(probeFile);
  }

  getDownloadFolderPath(downloadFolder: string): string {
    return this.inputOutputPathPort.resolve(process.cwd(), downloadFolder);
  }

  getIncomingFolderPath(downloadFolder: string): string {
    return this.inputOutputPathPort.join(this.getDownloadFolderPath(downloadFolder), '_incoming');
  }

  getLeftoversFolderPath(downloadFolder: string): string {
    return this.inputOutputPathPort.join(this.getDownloadFolderPath(downloadFolder), '_leftovers');
  }

  getPropertyFolderPath(downloadFolder: string, propertyId: string): string {
    return this.inputOutputPathPort.join(this.getDownloadFolderPath(downloadFolder), propertyId);
  }

  joinPath(...segments: string[]): string {
    return this.inputOutputPathPort.join(...segments);
  }
}
