import { HttpClient, HttpResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type DatabaseMaintenanceOperationResult = {
  status: number;
  body: unknown;
};

export abstract class DatabaseMaintenanceOperation {
  constructor(
    public readonly i18nId: string,
    private readonly endpointPath: string
  ) {}

  async execute(http: HttpClient, backendBaseUrl: string): Promise<DatabaseMaintenanceOperationResult> {
    const endpointUrl = this.buildEndpointUrl(backendBaseUrl);
    const response = await firstValueFrom(
      http.get<unknown>(endpointUrl, { observe: 'response' })
    );

    return this.toResult(response);
  }

  private toResult(response: HttpResponse<unknown>): DatabaseMaintenanceOperationResult {
    return {
      status: response.status,
      body: response.body
    };
  }

  private buildEndpointUrl(backendBaseUrl: string): string {
    const base = backendBaseUrl.endsWith('/')
      ? backendBaseUrl.slice(0, -1)
      : backendBaseUrl;
    return `${base}${this.endpointPath}`;
  }
}
