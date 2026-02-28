export type ImageResponseBodyPayload = {
  requestId: string;
  url: string;
  mimeType: string;
  body: {
    body: string;
    base64Encoded: boolean;
  };
};
