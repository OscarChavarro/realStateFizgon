import { Injectable } from '@nestjs/common';
import { constants, accessSync, closeSync, existsSync, mkdirSync, openSync, unlinkSync, writeFileSync } from 'node:fs';
import { access } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import type { InputOutputFileAccessPort } from 'ports/outbound/input-output/input-output-file-access.port';
import type { InputOutputPathPort } from 'ports/outbound/input-output/input-output-path.port';

@Injectable()
export class NodeInputOutputService implements InputOutputPathPort, InputOutputFileAccessPort {
  join(...segments: string[]): string {
    return join(...segments);
  }

  resolve(...segments: string[]): string {
    return resolve(...segments);
  }

  fileExists(path: string): boolean {
    return existsSync(path);
  }

  ensureDirectory(path: string): void {
    mkdirSync(path, { recursive: true });
  }

  assertReadableWritable(path: string): void {
    accessSync(path, constants.R_OK | constants.W_OK);
  }

  writeTextFile(path: string, content: string): void {
    writeFileSync(path, content);
  }

  deleteFile(path: string): void {
    unlinkSync(path);
  }

  openFileForAppend(path: string): number {
    return openSync(path, 'a');
  }

  closeFileDescriptor(fileDescriptor: number): void {
    closeSync(fileDescriptor);
  }

  async pathExists(path: string): Promise<boolean> {
    try {
      await access(path, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
}
