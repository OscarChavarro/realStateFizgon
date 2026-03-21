import type { DownloadedIncomingImage } from 'application/dto/imagedownload/downloaded-incoming-image.dto';

export type PendingImageRequest = {
  url: string;
  mimeType: string;
};

export type ScrapeRunImageNetworkState = {
  initializedClients: WeakSet<object>;
  pendingImageRequests: Map<string, PendingImageRequest>;
  activeDownloadTasks: Set<Promise<void>>;
  lastImageNetworkActivityAt: number;
  imageNetworkActivitySeen: boolean;
  imageNetworkActivityCounter: number;
};

export type ScrapeRunImageState = {
  incomingImagesByKey: Map<string, DownloadedIncomingImage[]>;
  networkCapture: ScrapeRunImageNetworkState;
};

export type ScrapeRunContext = {
  processedPropertyUrls: Set<string>;
  image: ScrapeRunImageState;
};

export function createScrapeRunContext(): ScrapeRunContext {
  return {
    processedPropertyUrls: new Set<string>(),
    image: {
      incomingImagesByKey: new Map<string, DownloadedIncomingImage[]>(),
      networkCapture: {
        initializedClients: new WeakSet<object>(),
        pendingImageRequests: new Map<string, PendingImageRequest>(),
        activeDownloadTasks: new Set<Promise<void>>(),
        lastImageNetworkActivityAt: 0,
        imageNetworkActivitySeen: false,
        imageNetworkActivityCounter: 0
      }
    }
  };
}
