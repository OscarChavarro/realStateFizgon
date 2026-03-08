import { jest } from '@jest/globals';

export class QueuePublisherPortMock {
  readonly publishJsonToQueue = jest.fn<(queueName: string, payload: unknown) => Promise<void>>();
}
