type MongoConfigMockOptions = {
  connectionUri?: string;
  database?: string;
};

export class MongoConfigMock {
  constructor(private readonly options: MongoConfigMockOptions = {}) {}

  get mongoConnectionUri(): string {
    return this.options.connectionUri ?? 'mongodb://user:pass@localhost:27017/idealista?authSource=admin';
  }

  get mongoDatabase(): string {
    return this.options.database ?? 'idealista';
  }
}
