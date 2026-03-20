import { describe, expect, it, jest } from '@jest/globals';
import { ImageDownloadPathService } from 'application/services/imagedownload/image-download-path.service';

import type { InputOutputFileAccessPort } from 'ports/outbound/input-output/input-output-file-access.port';
import type { InputOutputPathPort } from 'ports/outbound/input-output/input-output-path.port';

class InputOutputPathPortMock implements InputOutputPathPort {
  readonly join = jest.fn((...segments: string[]) => segments.join('/'));
  readonly resolve = jest.fn((...segments: string[]) => segments.join('/'));
}

class InputOutputFileAccessPortMock implements InputOutputFileAccessPort {
  readonly fileExists = jest.fn<(path: string) => boolean>();
  readonly ensureDirectory = jest.fn<(path: string) => void>();
  readonly assertReadableWritable = jest.fn<(path: string) => void>();
  readonly writeTextFile = jest.fn<(path: string, content: string) => void>();
  readonly deleteFile = jest.fn<(path: string) => void>();
  readonly openFileForAppend = jest.fn<(path: string) => number>();
  readonly closeFileDescriptor = jest.fn<(fileDescriptor: number) => void>();
  readonly pathExists = jest.fn<(path: string) => Promise<boolean>>();
}

function createService() {
  const pathPort = new InputOutputPathPortMock();
  const fileAccessPort = new InputOutputFileAccessPortMock();
  const clockPort = { nowMs: jest.fn<() => number>().mockReturnValue(1700000000000) };
  fileAccessPort.fileExists.mockReturnValue(false);
  return {
    service: new ImageDownloadPathService(pathPort, fileAccessPort, clockPort as never),
    pathPort,
    fileAccessPort
  };
}

describe('ImageDownloadPathService', () => {
  it('whenWritableFoldersAreEnsured_ensureWritableFolders_shouldCreateAndValidateAllFoldersWithProbeFile', () => {
    // Arrange
    const { service, fileAccessPort } = createService();
    // Action
    service.ensureWritableFolders('output/images');
    // Assert
    expect(fileAccessPort.ensureDirectory).toHaveBeenCalledTimes(3);
    expect(fileAccessPort.assertReadableWritable).toHaveBeenCalledTimes(3);
    expect(fileAccessPort.writeTextFile).toHaveBeenCalledTimes(1);
    expect(fileAccessPort.deleteFile).toHaveBeenCalledTimes(1);
  });

  it('whenAllFoldersAlreadyExist_ensureWritableFolders_shouldSkipDirectoryCreation', () => {
    // Arrange
    const { service, fileAccessPort } = createService();
    fileAccessPort.fileExists.mockReturnValue(true);
    // Action
    service.ensureWritableFolders('output/images');
    // Assert
    expect(fileAccessPort.ensureDirectory).not.toHaveBeenCalled();
    expect(fileAccessPort.assertReadableWritable).toHaveBeenCalledTimes(3);
  });

  it('whenPathHelpersAreUsed_getPathMethods_shouldReturnExpectedComposedValues', () => {
    // Arrange
    const { service } = createService();
    // Action
    const values = {
      download: service.getDownloadFolderPath('output/images'),
      incoming: service.getIncomingFolderPath('output/images'),
      leftovers: service.getLeftoversFolderPath('output/images'),
      propertyFolder: service.getPropertyFolderPath('output/images', '123'),
      joined: service.joinPath('a', 'b', 'c')
    };
    // Assert
    expect(values.download).toContain('output/images');
    expect(values.incoming).toContain('_incoming');
    expect(values.leftovers).toContain('_leftovers');
    expect(values.propertyFolder).toContain('/123');
    expect(values.joined).toBe('a/b/c');
  });
});
