import { ExecutionContext } from '@nestjs/common';
import { jest } from '@jest/globals';

type HttpRequest = {
  headers?: Record<string, unknown>;
};

type HttpResponse = {
  setHeader: (name: string, value: string) => void;
};

export class HttpExecutionContextMock {
  readonly response = {
    setHeader: jest.fn<(name: string, value: string) => void>()
  };

  constructor(private readonly request: HttpRequest) {}

  toExecutionContext(): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => this.request,
        getResponse: () => this.response as HttpResponse
      })
    } as unknown as ExecutionContext;
  }
}
