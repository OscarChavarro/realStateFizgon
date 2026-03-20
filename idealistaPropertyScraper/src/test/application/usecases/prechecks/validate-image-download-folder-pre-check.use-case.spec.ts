import { describe, expect, it, jest } from '@jest/globals';
import { ImageDownloaderService } from 'application/services/imagedownload/image-downloader';
import { ValidateImageDownloadFolderPreCheckUseCase } from 'application/usecases/prechecks/validate-image-download-folder-pre-check.use-case';

class ImageDownloaderMockForValidateImageDownloadFolderPreCheckUseCase {
  readonly validateImageDownloadFolder = jest.fn<() => Promise<void>>();
}

describe('ValidateImageDownloadFolderPreCheckUseCase', () => {
  it('whenImageDownloadFolderIsReady_execute_shouldValidateFolderThroughImageDownloader', async () => {
    // Arrange
    const imageDownloader = new ImageDownloaderMockForValidateImageDownloadFolderPreCheckUseCase();
    imageDownloader.validateImageDownloadFolder.mockResolvedValue(undefined);
    const useCase = new ValidateImageDownloadFolderPreCheckUseCase(
      imageDownloader as unknown as ImageDownloaderService
    );
    // Action
    await useCase.execute();
    // Assert
    expect(imageDownloader.validateImageDownloadFolder).toHaveBeenCalledTimes(1);
  });

  it('whenImageDownloadFolderValidationFails_execute_shouldPropagateError', async () => {
    // Arrange
    const imageDownloader = new ImageDownloaderMockForValidateImageDownloadFolderPreCheckUseCase();
    imageDownloader.validateImageDownloadFolder.mockRejectedValue(new Error('folder unavailable'));
    const useCase = new ValidateImageDownloadFolderPreCheckUseCase(
      imageDownloader as unknown as ImageDownloaderService
    );
    // Action
    const action = useCase.execute();
    // Assert
    await expect(action).rejects.toThrow('folder unavailable');
  });
});
