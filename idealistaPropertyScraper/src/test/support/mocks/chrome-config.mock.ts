type ChromeConfigMockOptions = {
  browserLaunchRetryWaitMs?: number;
};

export class ChromeConfigMock {
  constructor(private readonly options: ChromeConfigMockOptions = {}) {}

  get chromeBrowserLaunchRetryWaitMs(): number {
    return this.options.browserLaunchRetryWaitMs ?? 10;
  }
}
