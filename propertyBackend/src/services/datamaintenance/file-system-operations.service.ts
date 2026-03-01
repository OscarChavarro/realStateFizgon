import { Injectable } from '@nestjs/common';
import { Dirent } from 'node:fs';
import { readdir, rm, unlink } from 'node:fs/promises';

@Injectable()
export class FileSystemOperationsService {
  async readDirectoryEntries(path: string): Promise<Dirent[]> {
    return readdir(path, { withFileTypes: true });
  }

  async removeFile(path: string): Promise<void> {
    await unlink(path);
  }

  async removeDirectoryRecursively(path: string): Promise<void> {
    await rm(path, { recursive: true, force: true });
  }
}

