export type HttpBinaryDownloadResult = {
  ok: boolean;
  status: number;
  bytes: Buffer;
};

export interface HttpBinaryDownloadPort {
  download(url: string): Promise<HttpBinaryDownloadResult>;
}
