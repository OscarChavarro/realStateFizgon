export interface PersistenceHealthPort {
  validateConnectionOrExit(): Promise<void>;
}
