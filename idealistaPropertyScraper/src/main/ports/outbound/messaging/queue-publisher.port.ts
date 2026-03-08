export interface QueuePublisherPort {
  publishJsonToQueue(queueName: string, payload: unknown): Promise<void>;
}
