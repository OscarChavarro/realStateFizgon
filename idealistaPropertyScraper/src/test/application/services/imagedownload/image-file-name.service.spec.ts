import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { access } from 'node:fs/promises';
import { ImageFileNameService } from 'src/application/services/imagedownload/image-file-name.service';
import { ImageUrlRulesService } from 'src/application/services/imagedownload/image-url-rules.service';

jest.mock('node:fs/promises', () => ({
  access: jest.fn()
}));

describe('ImageFileNameService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('whenFilenameIsBuilt_buildImageFilename_shouldIncludeTimestampHashAndResolvedExtension', () => {
    // Arrange
    const service = new ImageFileNameService(new ImageUrlRulesService());
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
    const service = new ImageFileNameService(new ImageUrlRulesService());
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
    const service = new ImageFileNameService(new ImageUrlRulesService());
    // Action
    const fileName = service.buildCompatibleTargetFilename(imageUrl, downloadedExtension);
    // Assert
    expect(fileName.endsWith(expected)).toBe(true);
  });

  it.each([
    { accessBehavior: async () => undefined, expected: true },
    { accessBehavior: async () => { throw new Error('missing'); }, expected: false }
  ])('whenPathExistenceIsChecked_pathExists_shouldReturnExpectedResult', async ({ accessBehavior, expected }) => {
    // Arrange
    const service = new ImageFileNameService(new ImageUrlRulesService());
    const accessMock = access as unknown as jest.MockedFunction<typeof access>;
    accessMock.mockImplementation(accessBehavior as unknown as typeof access);
    // Action
    const exists = await service.pathExists('/tmp/some-path');
    // Assert
    expect(exists).toBe(expected);
  });
});
