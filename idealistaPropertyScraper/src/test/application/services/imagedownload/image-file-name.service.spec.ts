import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ImageFileNameService } from 'application/services/imagedownload/image-file-name.service';
import { ImageUrlRulesService } from 'application/services/imagedownload/image-url-rules.service';

import type { InputOutputFileAccessPort } from 'ports/outbound/input-output/input-output-file-access.port';

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

describe('ImageFileNameService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('whenFilenameIsBuilt_buildImageFilename_shouldIncludeTimestampHashAndResolvedExtension', () => {
    // Arrange
    const service = new ImageFileNameService(new ImageUrlRulesService(), new InputOutputFileAccessPortMock());
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1234567890);
    // Action
    const filename = service.buildImageFilename('https://img4.idealista.com/a/b/c/photo.jpeg', 'image/jpeg');
    // Assert
    expect(filename).toMatch(/^1234567890-[a-f0-9]{40}\.jpg$/);
    nowSpy.mockRestore();
  });

  it.each([
    { url: 'https://img4.idealista.com/photo.jpeg', mimeType: 'image/png', expected: '.jpg' },
    { url: 'https://img4.idealista.com/photo', mimeType: 'image/jpeg', expected: '.jpg' },
    { url: 'https://img4.idealista.com/photo', mimeType: 'image/png', expected: '.png' },
    { url: 'https://img4.idealista.com/photo', mimeType: 'image/webp', expected: '.webp' },
    { url: 'https://img4.idealista.com/photo', mimeType: 'image/gif', expected: '.gif' },
    { url: 'https://img4.idealista.com/photo', mimeType: 'image/svg+xml', expected: '.svg' },
    { url: 'https://img4.idealista.com/photo', mimeType: 'application/octet-stream', expected: '.img' }
  ])('whenExtensionIsResolved_resolveImageExtension_shouldReturnExpectedExtension', ({ url, mimeType, expected }) => {
    // Arrange
    const service = new ImageFileNameService(new ImageUrlRulesService(), new InputOutputFileAccessPortMock());
    // Action
    const extension = service.resolveImageExtension(url, mimeType);
    // Assert
    expect(extension).toBe(expected);
  });

  it.each([
    {
      imageUrl: 'https://img4.idealista.com/blur/WEB_DETAIL/0/id.pro.es.image.master/ba/03/bc/1388548264.jpg',
      downloadedExtension: '.webp',
      expected: 'ba_03_bc_1388548264.jpg'
    },
    {
      imageUrl: 'not-a-url',
      downloadedExtension: '.png',
      expected: '.png'
    },
    {
      imageUrl: 'https://img4.idealista.com/photo',
      downloadedExtension: '.png',
      expected: 'photo.png'
    },
    {
      imageUrl: 'https://img4.idealista.com/',
      downloadedExtension: '',
      expected: 'image.img'
    }
  ])('whenTargetFilenameIsBuilt_buildCompatibleTargetFilename_shouldUseCompatibleNameAndExtension', ({
    imageUrl,
    downloadedExtension,
    expected
  }) => {
    // Arrange
    const service = new ImageFileNameService(new ImageUrlRulesService(), new InputOutputFileAccessPortMock());
    // Action
    const fileName = service.buildCompatibleTargetFilename(imageUrl, downloadedExtension);
    // Assert
    expect(fileName.endsWith(expected)).toBe(true);
  });

  it.each([
    { exists: true },
    { exists: false }
  ])('whenPathExistenceIsChecked_pathExists_shouldDelegateToInputOutputFileAccessPort', async ({ exists }) => {
    // Arrange
    const inputOutputFileAccessPort = new InputOutputFileAccessPortMock();
    inputOutputFileAccessPort.pathExists.mockResolvedValue(exists);
    const service = new ImageFileNameService(new ImageUrlRulesService(), inputOutputFileAccessPort);
    // Action
    const result = await service.pathExists('/tmp/some-path');
    // Assert
    expect(result).toBe(exists);
    expect(inputOutputFileAccessPort.pathExists).toHaveBeenCalledWith('/tmp/some-path');
  });
});
