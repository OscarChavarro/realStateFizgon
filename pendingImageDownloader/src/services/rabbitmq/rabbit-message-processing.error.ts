export class RabbitMessageProcessingError extends Error {
  constructor(
    message: string,
    public readonly shouldRequeue: boolean
  ) {
    super(message);
  }
}
