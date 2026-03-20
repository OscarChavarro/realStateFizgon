export interface ErrorMessagePort {
  toErrorMessage(error: unknown): string;
}
