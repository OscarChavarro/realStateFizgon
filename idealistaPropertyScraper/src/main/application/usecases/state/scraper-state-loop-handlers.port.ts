export type ScraperStateLoopHandlers = {
  onScrapingForNewProperties: () => Promise<void>;
  onUpdatingProperties: () => Promise<void>;
  isShuttingDown: () => boolean;
};
