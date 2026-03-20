import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { HttpBinaryDownloadService } from 'adapters/outbound/network/http-binary-download.service';

describe('HttpBinaryDownloadService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('whenResponseIsSuccessful_download_shouldReturnOkStatusAndBytes', async () => {
    // Arrange
    const service = new HttpBinaryDownloadService();
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer
    } as Response);
    // Action
    const result = await service.download('https://img/ok.jpg');
    // Assert
    expect(result).toEqual({ ok: true, status: 200, bytes: Buffer.from([1, 2, 3]) });
    expect(fetchSpy).toHaveBeenCalledWith('https://img/ok.jpg');
    fetchSpy.mockRestore();
  });

  it('whenResponseIsNotSuccessful_download_shouldReturnNonOkStatusAndEmptyBytes', async () => {
    // Arrange
    const service = new HttpBinaryDownloadService();
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      arrayBuffer: async () => new ArrayBuffer(0)
    } as Response);
    // Action
    const result = await service.download('https://img/missing.jpg');
    // Assert
    expect(result).toEqual({ ok: false, status: 404, bytes: Buffer.alloc(0) });
    expect(fetchSpy).toHaveBeenCalledWith('https://img/missing.jpg');
    fetchSpy.mockRestore();
  });
});
