export type NetworkResponseReceivedEvent = {
  requestId: string;
  type?: string;
  response: {
    url: string;
    mimeType?: string;
  };
};
