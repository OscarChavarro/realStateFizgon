export type ScraperStateLoopHandlers = {
  onScrapingForNewProperties: () => Promise<void>;
  onUpdatingProperties: () => Promise<void>;
  onLoopError: (error: unknown) => Promise<void>;
  isShuttingDown: () => boolean;
};
