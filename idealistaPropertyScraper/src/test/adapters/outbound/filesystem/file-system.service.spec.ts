import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { FileSystemService } from 'adapters/outbound/filesystem/file-system.service';

jest.mock('node:fs/promises', () => ({
  mkdir: jest.fn(async () => undefined),
  readdir: jest.fn(async () => []),
  rename: jest.fn(async () => undefined),
  rm: jest.fn(async () => undefined),
  writeFile: jest.fn(async () => undefined)
}));

describe('FileSystemService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('whenEnsuringDirectory_ensureDirectory_shouldCreateDirectoryRecursively', async () => {
    // Arrange
    const service = new FileSystemService();
    // Action
    await service.ensureDirectory('/tmp/images/property');
    // Assert
    expect(mkdir).toHaveBeenCalledWith('/tmp/images/property', { recursive: true });
  });

  it('whenListingEntries_listEntries_shouldMapDirentFlags', async () => {
    // Arrange
    const service = new FileSystemService();
    (readdir as unknown as jest.Mock).mockImplementationOnce(async () => [
      { name: 'a.jpg', isFile: () => true, isDirectory: () => false },
      { name: 'nested', isFile: () => false, isDirectory: () => true },
      { name: 'socket', isFile: () => false, isDirectory: () => false }
    ]);
    // Action
    const result = await service.listEntries('/tmp/images/incoming');
    // Assert
    expect(readdir).toHaveBeenCalledWith('/tmp/images/incoming', { withFileTypes: true });
    expect(result).toEqual([
      { name: 'a.jpg', isFile: true, isDirectory: false },
      { name: 'nested', isFile: false, isDirectory: true },
      { name: 'socket', isFile: false, isDirectory: false }
    ]);
  });

  it('whenMovingPath_move_shouldRenameSourceToTarget', async () => {
    // Arrange
    const service = new FileSystemService();
    // Action
    await service.move('/tmp/source.jpg', '/tmp/target.jpg');
    // Assert
    expect(rename).toHaveBeenCalledWith('/tmp/source.jpg', '/tmp/target.jpg');
  });

  it('whenDeletingFile_deleteFile_shouldRemoveWithForceOnly', async () => {
    // Arrange
    const service = new FileSystemService();
    // Action
    await service.deleteFile('/tmp/file.jpg');
    // Assert
    expect(rm).toHaveBeenCalledWith('/tmp/file.jpg', { force: true });
  });

  it('whenDeletingDirectory_deleteDirectory_shouldRemoveRecursivelyWithForce', async () => {
    // Arrange
    const service = new FileSystemService();
    // Action
    await service.deleteDirectory('/tmp/folder');
    // Assert
    expect(rm).toHaveBeenCalledWith('/tmp/folder', { recursive: true, force: true });
  });

  it('whenWritingFile_writeFile_shouldPersistBufferAsIs', async () => {
    // Arrange
    const service = new FileSystemService();
    const bytes = Buffer.from([1, 2, 3]);
    // Action
    await service.writeFile('/tmp/a.bin', bytes);
    // Assert
    expect(writeFile).toHaveBeenCalledWith('/tmp/a.bin', bytes);
  });
});
