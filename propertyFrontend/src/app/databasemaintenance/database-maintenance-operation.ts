import { HttpClient, HttpResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type DatabaseMaintenanceOperationResult = {
  status: number;
  body: unknown;
};

export abstract class DatabaseMaintenanceOperation {
  constructor(
    public readonly i18nId: string,
    private readonly endpointUrl: string
  ) {}

  async execute(http: HttpClient): Promise<DatabaseMaintenanceOperationResult> {
    const response = await firstValueFrom(
      http.get<unknown>(this.endpointUrl, { observe: 'response' })
    );

    return this.toResult(response);
  }

  private toResult(response: HttpResponse<unknown>): DatabaseMaintenanceOperationResult {
    return {
      status: response.status,
      body: response.body
    };
  }
}

