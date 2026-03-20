import { Injectable } from '@nestjs/common';
import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';

import type { FileSystemEntry, FileSystemPort } from 'src/ports/outbound/filesystem/file-system.port';

@Injectable()
export class FileSystemService implements FileSystemPort {
  async ensureDirectory(path: string): Promise<void> {
    await mkdir(path, { recursive: true });
  }

  async listEntries(path: string): Promise<FileSystemEntry[]> {
    const entries = await readdir(path, { withFileTypes: true });
    return entries.map((entry) => ({
      name: entry.name,
      isFile: entry.isFile(),
      isDirectory: entry.isDirectory()
    }));
  }

  async move(sourcePath: string, targetPath: string): Promise<void> {
    await rename(sourcePath, targetPath);
  }

  async deleteFile(path: string): Promise<void> {
    await rm(path, { force: true });
  }

  async deleteDirectory(path: string): Promise<void> {
    await rm(path, { recursive: true, force: true });
  }

  async writeFile(path: string, bytes: Buffer): Promise<void> {
    await writeFile(path, bytes);
  }
}
