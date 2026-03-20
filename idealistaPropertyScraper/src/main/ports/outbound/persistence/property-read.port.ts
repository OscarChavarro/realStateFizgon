export interface PropertyReadPort {
  isOpenPropertyByUrl(url: string): Promise<boolean>;
  hasGeoLocationHintByUrl(url: string): Promise<boolean>;
  getOpenPropertyUrlsWithoutLastTimeVisited(): Promise<string[]>;
  getOpenPropertyUrls(): Promise<string[]>;
}
