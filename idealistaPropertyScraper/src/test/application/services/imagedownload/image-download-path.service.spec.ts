import { afterEach, describe, expect, it, jest } from '@jest/globals';
import * as fs from 'node:fs';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ImageDownloadPathService } from 'src/application/services/imagedownload/image-download-path.service';

const foldersToDelete: string[] = [];

describe('ImageDownloadPathService', () => {
  afterEach(() => {
    for (const folder of foldersToDelete.splice(0)) {
      rmSync(folder, { recursive: true, force: true });
    }
  });

  it('whenWritableFoldersAreEnsured_ensureWritableFolders_shouldCreateDownloadIncomingAndLeftoversFolders', () => {
    // Arrange
    const service = new ImageDownloadPathService();
    const folderName = join(tmpdir(), `idealista-image-test-${Date.now()}`);
    foldersToDelete.push(folderName);
    // Action
    service.ensureWritableFolders(folderName);
    // Assert
    expect(existsSync(service.getDownloadFolderPath(folderName))).toBe(true);
    expect(existsSync(service.getIncomingFolderPath(folderName))).toBe(true);
    expect(existsSync(service.getLeftoversFolderPath(folderName))).toBe(true);
  });

  it('whenPathHelpersAreUsed_getPathMethods_shouldReturnExpectedSuffixes', () => {
    // Arrange
    const service = new ImageDownloadPathService();
    // Action
    const values = {
      download: service.getDownloadFolderPath('output/images'),
      incoming: service.getIncomingFolderPath('output/images'),
      leftovers: service.getLeftoversFolderPath('output/images')
    };
    // Assert
    expect(values.download.endsWith(join('output', 'images'))).toBe(true);
    expect(values.incoming.endsWith(join('output', 'images', '_incoming'))).toBe(true);
    expect(values.leftovers.endsWith(join('output', 'images', '_leftovers'))).toBe(true);
  });

  it('whenAllFoldersAlreadyExist_ensureWritableFolders_shouldSkipDirectoryCreation', () => {
    // Arrange
    const service = new ImageDownloadPathService();
    const folderName = join(tmpdir(), `idealista-image-existing-${Date.now()}`);
    foldersToDelete.push(folderName);
    mkdirSync(service.getDownloadFolderPath(folderName), { recursive: true });
    mkdirSync(service.getIncomingFolderPath(folderName), { recursive: true });
    mkdirSync(service.getLeftoversFolderPath(folderName), { recursive: true });
    const mkdirSpy = jest.spyOn(fs, 'mkdirSync');
    // Action
    service.ensureWritableFolders(folderName);
    // Assert
    expect(mkdirSpy).not.toHaveBeenCalled();
    mkdirSpy.mockRestore();
  });
});
